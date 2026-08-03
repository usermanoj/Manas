'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BRAND } from '@/lib/config/brand';

interface StepData {
  order: number;
  instruction: string;
  durationSeconds: number;
}

interface DraftModule {
  id: string;
  title: string;
  purpose: string;
  status: string;
  currentVersionId: string | null;
  primaryLanguage: string;
}

interface DraftVersion {
  id: string;
  moduleId: string;
  versionNumber: number;
  steps: StepData[];
  warnings: string[];
  contraindications: string[];
  escalationConditions: string[];
  language: string;
  reviewStatus: string;
  translationStatus: string;
}

interface CompileResponse {
  draftModule: DraftModule;
  draftVersion: DraftVersion;
  validationWarnings: string[];
}

const SAMPLE_TEXT = `# Title
Pause and Reflect

# Purpose
A guided micro-exercise that helps the user slow down, notice their current state, and reflect on what they need right now.

# Steps
1. Close your eyes or soften your gaze. Take three slow breaths. (30 seconds)
2. Notice what you are feeling in your body right now. Name it silently. (45 seconds)
3. Ask yourself: "What do I need most right now?" Sit with the answer for a moment. (60 seconds)
4. When you are ready, write one sentence about what came up for you. (2 minutes)

# Warnings
- If you feel overwhelmed at any point, pause the exercise and take a break.
- This module is not a substitute for professional mental-health care.

# Contraindications
- Active crisis or suicidal ideation — route to immediate resources instead.

# Escalation Conditions
- User reports feeling unsafe during the exercise.
- User reports dissociation or severe distress.`;

export default function ClinicianContentPage(): React.ReactNode {
  const [pastedText, setPastedText] = useState('');
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [result, setResult] = useState<CompileResponse | null>(null);

  const handleCompile = async (): Promise<void> => {
    if (!pastedText.trim()) {
      setError('Please paste some wellbeing content text before compiling.');
      return;
    }

    setCompiling(true);
    setError(null);
    setSuccessMessage(null);
    setResult(null);

    try {
      const res = await fetch('/api/content/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pastedText, language: 'en' }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? 'Failed to compile module');
      }

      const data: CompileResponse = await res.json();
      setResult(data);
      setSuccessMessage('Draft module compiled and saved in DRAFT status.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCompiling(false);
    }
  };

  const handleSubmitForReview = (): void => {
    // P0 demo: the compile endpoint already creates the DRAFT.
    // The review submission can be a separate API call in future P1.
    setSuccessMessage('Module is ready for clinical review. A human reviewer must approve this module before it can be activated.');
  };

  const handleLoadSample = (): void => {
    setPastedText(SAMPLE_TEXT);
    setError(null);
    setSuccessMessage(null);
    setResult(null);
  };

  const handleClear = (): void => {
    setPastedText('');
    setError(null);
    setSuccessMessage(null);
    setResult(null);
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Synthetic-data disclaimer banner */}
      <div className="bg-secondary/10 border-b border-secondary/30">
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 py-3`}>
          <p className="text-sm text-text-muted text-center">
            Fictional clinician workspace — all people, handoffs and content modules shown here are
            synthetic demonstration data. {BRAND.prototypeLabel}
          </p>
        </div>
      </div>

      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        <div className="flex items-center justify-between mb-6">
          <h1 className={`${BRAND.typography.headingSize} font-semibold text-text`}>
            Content Compiler
          </h1>
          <Link href="/clinician" className="text-sm text-primary hover:underline">
            &larr; Back to Inbox
          </Link>
        </div>

        <p className="text-text-muted text-sm mb-6">
          Paste wellbeing content text below. The compiler uses deterministic parsing (not AI) to
          extract a structured draft module. AI may create DRAFT only — a human reviewer must
          approve before activation.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-4">
            Error: {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm mb-4">
            {successMessage}
          </div>
        )}

        {/* Input section */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-text mb-3">Paste Wellbeing Content Text Below</h2>
          <div className="bg-surface border border-text/10 rounded-lg p-5">
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={14}
              className="w-full px-3 py-2 border border-text/20 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
              placeholder="Paste your wellbeing content text here. Use headings like # Title, # Purpose, # Steps, # Warnings, # Contraindications, # Escalation Conditions."
            />

            <div className="flex flex-wrap gap-3 mt-4">
              <button
                type="button"
                onClick={handleCompile}
                disabled={compiling}
                className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {compiling ? 'Compiling…' : 'Compile Module'}
              </button>
              <button
                type="button"
                onClick={handleLoadSample}
                disabled={compiling}
                className="px-4 py-2 border border-text/20 text-text text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Load Sample
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={compiling}
                className="px-4 py-2 border border-text/20 text-text text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </section>

        {/* Results section */}
        {result && (
          <section className="mb-8">
            <h2 className="text-lg font-medium text-text mb-3">Extracted Draft Module</h2>

            {/* Validation warnings */}
            {result.validationWarnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-yellow-800 mb-1">Validation Warnings</p>
                <ul className="text-sm text-yellow-700 pl-4 list-disc">
                  {result.validationWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Module card */}
            <div className="bg-surface border border-text/10 rounded-lg p-5">
              {/* Header row with status badge */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-text">{result.draftModule.title}</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Module ID: {result.draftModule.id} | Language: {result.draftModule.primaryLanguage}
                  </p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {result.draftModule.status}
                </span>
              </div>

              {/* Prototype disclaimer */}
              <div className="bg-secondary/5 border border-secondary/20 rounded-md px-3 py-2 mb-4">
                <p className="text-xs text-text-muted">{BRAND.prototypeLabel}</p>
              </div>

              {/* Purpose */}
              <div className="mb-4">
                <p className="text-sm font-medium text-text mb-1">Purpose</p>
                <p className="text-sm text-text-muted">{result.draftModule.purpose}</p>
              </div>

              {/* Steps */}
              {result.draftVersion.steps.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-text mb-2">Steps</p>
                  <ol className="space-y-2">
                    {result.draftVersion.steps.map((step, i) => (
                      <li key={i} className="text-sm text-text-muted pl-4 border-l-2 border-text/10">
                        <span className="font-medium text-text">{step.order}.</span>{' '}
                        {step.instruction}
                        {step.durationSeconds > 0 && (
                          <span className="ml-2 text-xs text-text-muted italic">
                            ({step.durationSeconds >= 60
                              ? `${Math.floor(step.durationSeconds / 60)} min`
                              : `${step.durationSeconds}s`})
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Warnings */}
              {result.draftVersion.warnings.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-text mb-1">Warnings</p>
                  <ul className="text-sm text-text-muted pl-4 list-disc space-y-1">
                    {result.draftVersion.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Contraindications */}
              {result.draftVersion.contraindications.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-text mb-1">Contraindications</p>
                  <ul className="text-sm text-text-muted pl-4 list-disc space-y-1">
                    {result.draftVersion.contraindications.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Escalation Conditions */}
              {result.draftVersion.escalationConditions.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-text mb-1">Escalation Conditions</p>
                  <ul className="text-sm text-text-muted pl-4 list-disc space-y-1">
                    {result.draftVersion.escalationConditions.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Version metadata */}
              <div className="border-t border-text/10 pt-3 mt-4">
                <p className="text-xs text-text-muted">
                  Version {result.draftVersion.versionNumber} | Review Status:{' '}
                  <span className="font-medium">{result.draftVersion.reviewStatus}</span> |
                  Translation: {result.draftVersion.translationStatus}
                </p>
              </div>

              {/* Submit for Review button */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleSubmitForReview}
                  disabled={compiling}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  Submit for Review
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Loading state */}
        {compiling && !result && (
          <section className="mb-8">
            <div className="bg-surface border border-text/10 rounded-lg p-8 text-center">
              <p className="text-text-muted text-sm">Compiling module…</p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
