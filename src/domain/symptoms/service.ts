import type { Repository } from '@/domain/repositories';
import type {
  SymptomEntry,
  SymptomCategory,
  SymptomSeverity,
  SymptomFrequency,
} from '@/domain/repositories';
import type { AuditLogger } from '@/domain/audit';

export interface SymptomServiceDeps {
  symptomEntryRepo: Repository<SymptomEntry>;
  auditLogger: AuditLogger;
}

export interface RecordSymptomInput {
  userId: string;
  sessionId?: string;
  text: string;
  category?: SymptomCategory;
  severity: SymptomSeverity;
  frequency: SymptomFrequency;
  impact: string;
}

const CATEGORY_KEYWORDS: Record<SymptomCategory, string[]> = {
  sleep: ['sleep', 'insomnia', 'tired', 'rest', 'nightmare', 'wake'],
  mood: ['mood', 'sad', 'anxious', 'overwhelmed', 'irritable', 'low', 'depressed', 'happy'],
  energy: ['energy', 'fatigue', 'exhausted', 'lethargic', 'wired'],
  focus: ['focus', 'concentrate', 'distracted', 'memory', 'forgetful', 'brain fog'],
  physical_tension: ['tension', 'headache', 'muscle', 'pain', 'chest', 'stomach', 'nausea'],
  social: ['social', 'lonely', 'isolated', 'friends', 'family', 'relationship'],
  work_stress: ['work', 'job', 'deadline', 'boss', 'colleague', 'burnout', 'stress'],
  other: [],
};

function inferCategory(text: string): SymptomCategory {
  const lower = text.toLowerCase();
  let best: SymptomCategory = 'other';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [SymptomCategory, string[]][]) {
    if (category === 'other') continue;
    const score = keywords.reduce((acc, keyword) => acc + (lower.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = category;
    }
  }

  return best;
}

export class SymptomService {
  constructor(private deps: SymptomServiceDeps) {}

  async recordSymptom(input: RecordSymptomInput): Promise<SymptomEntry> {
    const entry: SymptomEntry = {
      id: `symptom-${crypto.randomUUID()}`,
      userId: input.userId,
      sessionId: input.sessionId,
      text: input.text.trim(),
      category: input.category ?? inferCategory(input.text),
      severity: input.severity,
      frequency: input.frequency,
      impact: input.impact.trim(),
      createdAt: new Date(),
    };

    const created = await this.deps.symptomEntryRepo.create(entry);

    await this.deps.auditLogger.log({
      requestId: created.id,
      userId: input.userId,
      actor: 'user',
      eventType: 'SYMPTOM_RECORDED',
      details: { category: created.category, severity: created.severity },
    });

    return created;
  }

  async getSymptomsForUser(userId: string): Promise<SymptomEntry[]> {
    return this.deps.symptomEntryRepo.findAll({ userId });
  }

  async deleteSymptom(userId: string, symptomId: string): Promise<boolean> {
    const entry = await this.deps.symptomEntryRepo.findById(symptomId);
    if (!entry || entry.userId !== userId) {
      return false;
    }

    const deleted = await this.deps.symptomEntryRepo.delete(symptomId);
    if (deleted) {
      await this.deps.auditLogger.log({
        requestId: `delete-${symptomId}`,
        userId,
        actor: 'user',
        eventType: 'SYMPTOM_DELETED',
        details: { symptomId },
      });
    }
    return deleted;
  }

  categorize(text: string): SymptomCategory {
    return inferCategory(text);
  }
}
