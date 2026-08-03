import type { ContentModule, ContentModuleVersion, Repository } from '@/domain/repositories';
import type { AuditLogger } from '@/domain/audit';
import { AuditEventType } from '@/domain/audit';
import { validateContentReviewTransition } from '@/domain/state-machines';
import type { ContentReviewStatus } from '@/domain/state-machines';

/**
 * Content Compiler Orchestrator
 *
 * AI constraint: AI creates DRAFT only — never APPROVED.
 * Content compiler creates: DRAFT or PENDING_CLINICAL_REVIEW only.
 *
 * Uses deterministic text parsing (NOT AI/ModelGateway) to extract a
 * structured draft from pasted wellbeing content text.
 */

export interface ContentModuleOrchestratorDeps {
  contentModuleRepo: Repository<ContentModule>;
  contentModuleVersionRepo: Repository<ContentModuleVersion>;
  auditLogger: AuditLogger;
}

export interface ExtractDraftResult {
  draftModule: ContentModule;
  draftVersion: ContentModuleVersion;
  validationWarnings: string[];
}

interface ParsedContent {
  title: string;
  purpose: string;
  steps: { order: number; instruction: string; durationSeconds: number }[];
  warnings: string[];
  contraindications: string[];
  escalationConditions: string[];
}

interface Section {
  heading: string;
  lines: string[];
}

export class ContentModuleOrchestrator {
  constructor(private deps: ContentModuleOrchestratorDeps) {}

  /**
   * Parse pasted text into a structured draft module and version.
   * Does NOT persist — call createDraft() to save.
   *
   * Parsing is deterministic and uses simple heuristics:
   * - Markdown headings (#) or ALL-CAPS lines mark section boundaries
   * - Section headings are mapped to known fields (title, purpose, steps, etc.)
   * - Numbered/bulleted items are parsed into list entries or step objects
   * - Duration is extracted from text like "30 seconds", "2 minutes", "60s"
   */
  extractDraftFromText(
    pastedText: string,
    language: 'en',
  ): ExtractDraftResult {
    const parsed = this.parseText(pastedText);
    const validationWarnings: string[] = [];

    if (!parsed.title.trim()) {
      validationWarnings.push('Missing: title');
    }
    if (!parsed.purpose.trim()) {
      validationWarnings.push('Missing: purpose');
    }
    if (parsed.steps.length === 0) {
      validationWarnings.push('Missing: steps');
    }

    const moduleId = crypto.randomUUID();
    const versionId = crypto.randomUUID();

    const draftModule: ContentModule = {
      id: moduleId,
      title: parsed.title.trim() || 'Untitled Module',
      purpose: parsed.purpose.trim() || 'No purpose specified.',
      status: 'DRAFT',
      currentVersionId: versionId,
      primaryLanguage: language,
    };

    const draftVersion: ContentModuleVersion = {
      id: versionId,
      moduleId,
      versionNumber: 1,
      steps: parsed.steps.map((s) => ({
        order: s.order,
        instruction: s.instruction,
        durationSeconds: s.durationSeconds,
      })),
      warnings: parsed.warnings,
      contraindications: parsed.contraindications,
      escalationConditions: parsed.escalationConditions,
      language,
      reviewStatus: 'DRAFT',
      translationStatus: 'PENDING',
    };

    return { draftModule, draftVersion, validationWarnings };
  }

  /**
   * Persist a draft module and its version, then log the audit event.
   */
  async createDraft(
    module: ContentModule,
    version: ContentModuleVersion,
  ): Promise<{ module: ContentModule; version: ContentModuleVersion }> {
    // Ensure the module references the version
    const moduleToSave: ContentModule = {
      ...module,
      currentVersionId: version.id,
    };

    const versionToSave: ContentModuleVersion = {
      ...version,
      moduleId: module.id,
    };

    await this.deps.contentModuleVersionRepo.create(versionToSave);
    await this.deps.contentModuleRepo.create(moduleToSave);

    await this.deps.auditLogger.log({
      requestId: module.id,
      userId: 'system',
      actor: 'clinician',
      eventType: AuditEventType.CONTENT_DRAFT_CREATED,
      details: {
        moduleId: module.id,
        versionId: version.id,
        title: module.title,
      },
    });

    return { module: moduleToSave, version: versionToSave };
  }

  /**
   * Transition a content module from DRAFT → PENDING_CLINICAL_REVIEW.
   * Uses the content-review state machine for validation.
   */
  async submitForReview(moduleId: string): Promise<ContentModule> {
    const contentModule = await this.deps.contentModuleRepo.findById(moduleId);
    if (!contentModule) {
      throw new Error(`ContentModule "${moduleId}" not found.`);
    }

    const currentStatus = contentModule.status as ContentReviewStatus;
    const transition = validateContentReviewTransition(currentStatus, 'submit_for_review');
    if (!transition.valid) {
      throw new Error(transition.error);
    }

    const updatedModule = await this.deps.contentModuleRepo.update(moduleId, {
      status: transition.nextStatus,
    });

    // Also update the version's reviewStatus if a version exists
    if (contentModule.currentVersionId) {
      const version = await this.deps.contentModuleVersionRepo.findById(contentModule.currentVersionId);
      if (version) {
        await this.deps.contentModuleVersionRepo.update(version.id, {
          reviewStatus: transition.nextStatus,
        });
      }
    }

    await this.deps.auditLogger.log({
      requestId: moduleId,
      userId: 'system',
      actor: 'clinician',
      eventType: AuditEventType.CONTENT_SUBMITTED_FOR_REVIEW,
      details: { moduleId, versionId: contentModule.currentVersionId },
    });

    return updatedModule;
  }

  // ─── Deterministic text parsing (private) ──────────────────────────────

  private parseText(text: string): ParsedContent {
    const lines = text.split('\n');

    const sections = this.splitIntoSections(lines);
    const result: ParsedContent = {
      title: '',
      purpose: '',
      steps: [],
      warnings: [],
      contraindications: [],
      escalationConditions: [],
    };

    for (const section of sections) {
      const headingKey = section.heading.toUpperCase();
      const content = section.lines.join('\n').trim();

      if (this.headingMatches(headingKey, ['TITLE', 'NAME'])) {
        result.title = content || section.lines.join(' ').trim();
      } else if (
        this.headingMatches(headingKey, [
          'PURPOSE',
          'INTRODUCTION',
          'DESCRIPTION',
          'OVERVIEW',
          'ABOUT',
        ])
      ) {
        result.purpose = content;
      } else if (this.headingMatches(headingKey, ['STEP', 'INSTRUCTION', 'EXERCISE', 'PROCEDURE'])) {
        result.steps = this.parseSteps(section.lines);
      } else if (this.headingMatches(headingKey, ['WARNING'])) {
        result.warnings = this.parseListItems(section.lines);
      } else if (this.headingMatches(headingKey, ['CONTRAINDICATION'])) {
        result.contraindications = this.parseListItems(section.lines);
      } else if (this.headingMatches(headingKey, ['ESCALATION'])) {
        result.escalationConditions = this.parseListItems(section.lines);
      }
    }

    // Fallback: if no sections were detected at all, try to extract from raw text
    if (sections.length === 0 || (!result.title && !result.purpose && result.steps.length === 0)) {
      const nonEmpty = lines.map((l) => l.trim()).filter((l) => l.length > 0);
      if (!result.title && nonEmpty.length > 0) {
        result.title = nonEmpty[0];
      }
      if (!result.purpose && nonEmpty.length > 1) {
        result.purpose = nonEmpty.slice(1).join(' ');
      }
      // Try to find numbered/bulleted steps anywhere in the text
      if (result.steps.length === 0) {
        const stepLines = nonEmpty.filter(
          (l) => /^\d+[.)]\s+/.test(l) || /^[-*]\s+/.test(l),
        );
        result.steps = this.parseSteps(stepLines);
      }
    }

    return result;
  }

  /**
   * Split raw lines into sections based on heading detection.
   * Headings are either markdown-style (# text) or ALL-CAPS short lines.
   */
  private splitIntoSections(lines: string[]): Section[] {
    const sections: Section[] = [];
    let current: Section | null = null;

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        continue;
      }

      const isMarkdownHeading = /^#{1,6}\s+\S/.test(trimmed);
      const isUppercaseHeading =
        /^[A-Z][A-Z0-9\s_&-]{2,}$/.test(trimmed) && trimmed.length < 60;

      if (isMarkdownHeading || isUppercaseHeading) {
        const heading = isMarkdownHeading
          ? trimmed.replace(/^#{1,6}\s+/, '').trim()
          : trimmed.trim();
        current = { heading: heading.toUpperCase(), lines: [] };
        sections.push(current);
      } else if (current) {
        current.lines.push(trimmed);
      } else {
        // No section yet — start an implicit section
        current = { heading: '', lines: [trimmed] };
        sections.push(current);
      }
    }

    return sections;
  }

  private headingMatches(heading: string, keywords: string[]): boolean {
    return keywords.some((kw) => heading.includes(kw));
  }

  /**
   * Parse lines into step objects with order, instruction, and durationSeconds.
   * Recognises numbered items (1., 1)) and bullet items (-, *).
   */
  private parseSteps(
    lines: string[],
  ): { order: number; instruction: string; durationSeconds: number }[] {
    const steps: { order: number; instruction: string; durationSeconds: number }[] = [];
    let currentInstruction = '';
    let order = 1;

    const flush = (): void => {
      if (currentInstruction.trim()) {
        const durationSeconds = this.extractDuration(currentInstruction);
        steps.push({
          order,
          instruction: currentInstruction.trim(),
          durationSeconds,
        });
        order++;
      }
      currentInstruction = '';
    };

    for (const line of lines) {
      const numberedMatch = line.match(/^\d+[.)]\s+(.+)/);
      const bulletMatch = line.match(/^[-*]\s+(.+)/);

      if (numberedMatch || bulletMatch) {
        flush();
        currentInstruction = (numberedMatch ?? bulletMatch)![1];
      } else {
        // Continuation of current step (or first line if no item yet)
        if (currentInstruction) {
          currentInstruction += ' ' + line;
        } else {
          currentInstruction = line;
        }
      }
    }
    flush();

    return steps;
  }

  /**
   * Parse lines into a list of plain string items.
   * Strips numbering/bullet prefixes.
   */
  private parseListItems(lines: string[]): string[] {
    const items: string[] = [];

    for (const line of lines) {
      const numberedMatch = line.match(/^\d+[.)]\s+(.+)/);
      const bulletMatch = line.match(/^[-*]\s+(.+)/);

      const text = numberedMatch
        ? numberedMatch[1]
        : bulletMatch
          ? bulletMatch[1]
          : line;

      if (text.trim()) {
        items.push(text.trim());
      }
    }

    return items;
  }

  /**
   * Extract a duration in seconds from text.
   * Recognises: "30 seconds", "30s", "2 minutes", "2 mins", "1 min"
   */
  private extractDuration(text: string): number {
    const secondsMatch = text.match(/(\d+)\s*(?:seconds?|secs?|s)\b/i);
    if (secondsMatch) {
      return parseInt(secondsMatch[1], 10);
    }

    const minutesMatch = text.match(/(\d+)\s*(?:minutes?|mins?)\b/i);
    if (minutesMatch) {
      return parseInt(minutesMatch[1], 10) * 60;
    }

    return 0;
  }
}
