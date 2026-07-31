'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/Layout';
import { ModuleDisclaimer } from '@/components/ModuleDisclaimer';
import { BRAND } from '@/lib/config/brand';
import { PAUSE_REFLECT_STEPS } from '@/domain/content';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONFIRMED_SUMMARY_KEY = 'manas-confirmed-summary';
const MODULE_ID = 'module-pause-reflect';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fireModuleEvent(eventType: 'MODULE_OPENED' | 'MODULE_COMPLETED' | 'MODULE_SKIPPED'): void {
  fetch('/api/module-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType, moduleId: MODULE_ID }),
  }).catch(() => {
    // Fire-and-forget — audit failure should not block the user.
  });
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function PauseReflectPage(): React.ReactNode {
  const [hasConfirmedSummary, setHasConfirmedSummary] = useState<boolean | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => PAUSE_REFLECT_STEPS.map(() => ''));
  const [completed, setCompleted] = useState(false);
  const [skipped, setSkipped] = useState(false);

  // Gate: check sessionStorage for confirmed summary on mount.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(CONFIRMED_SUMMARY_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage read on mount requires setState in effect
      setHasConfirmedSummary(stored !== null);
    } catch {
      setHasConfirmedSummary(false);
    }
  }, []);

  // Fire MODULE_OPENED on page load (once).
  const firedOpenedRef = useRef(false);
  useEffect(() => {
    if (hasConfirmedSummary && !firedOpenedRef.current) {
      firedOpenedRef.current = true;
      fireModuleEvent('MODULE_OPENED');
    }
  }, [hasConfirmedSummary]);

  const updateAnswer = useCallback((index: number, value: string): void => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleNext = useCallback((): void => {
    if (currentStep < PAUSE_REFLECT_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      // Last step — mark completed.
      setCompleted(true);
      fireModuleEvent('MODULE_COMPLETED');
    }
  }, [currentStep]);

  const handlePrevious = useCallback((): void => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback((): void => {
    setSkipped(true);
    fireModuleEvent('MODULE_SKIPPED');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      }
    },
    [handleNext],
  );

  // --- Still loading sessionStorage ---
  if (hasConfirmedSummary === null) {
    return (
      <Layout>
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        </div>
      </Layout>
    );
  }

  // --- Gate: no confirmed summary ---
  if (!hasConfirmedSummary) {
    return (
      <Layout>
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
          <div className="text-center py-12">
            <p className="text-text-muted text-lg mb-4">
              Please complete and confirm your check-in summary before starting this module.
            </p>
            <Link href="/check-in" className="text-primary hover:underline font-medium">
              Start a Check-In
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  // --- Completed or Skipped ---
  if (completed || skipped) {
    return (
      <Layout>
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
          <ModuleDisclaimer />

          <div data-testid="module-done" className="text-center py-8">
            <h1 className={`${BRAND.typography.headingSize} font-semibold text-text mb-4`}>
              {completed ? 'Reflection Complete' : 'Exercise Skipped'}
            </h1>
            <p className="text-text-muted mb-8">
              {completed
                ? 'Thank you for taking a moment to pause and reflect.'
                : 'You have skipped this exercise. You can return to it at any time.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                data-testid="continue-professionals"
                href="/professionals"
                className="bg-primary text-white hover:bg-primary-light rounded-lg px-6 py-3 text-lg font-medium transition-colors text-center"
              >
                Continue to Professionals
              </Link>
              <Link
                href="/"
                className="text-primary hover:underline flex items-center justify-center px-6 py-3 text-lg font-medium"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // --- Active wizard step ---
  const step = PAUSE_REFLECT_STEPS[currentStep] as { order: number; question: string };
  const isLastStep = currentStep === PAUSE_REFLECT_STEPS.length - 1;

  return (
    <Layout>
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        <ModuleDisclaimer />

        <h1 className={`${BRAND.typography.headingSize} font-semibold text-text mb-2`}>
          Pause &amp; Reflect
        </h1>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-6">
          {PAUSE_REFLECT_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= currentStep ? 'bg-primary' : 'bg-text/20'
              }`}
            />
          ))}
          <span className="ml-2 text-sm text-text-muted">
            {currentStep + 1} / {PAUSE_REFLECT_STEPS.length}
          </span>
        </div>

        {/* Step card */}
        <div data-testid={`step-${step.order}`} className="bg-surface rounded-xl shadow-sm p-6 mb-6">
          <label
            htmlFor={`answer-${step.order}`}
            className="block text-sm font-semibold text-text mb-3"
          >
            {step.question}
          </label>
          <textarea
            id={`answer-${step.order}`}
            data-testid={`answer-${step.order}`}
            value={answers[currentStep] ?? ''}
            onChange={(e) => updateAnswer(currentStep, e.target.value)}
            onKeyDown={handleKeyDown}
            rows={5}
            className="w-full border border-text/20 rounded-lg p-3 focus:ring-2 focus:ring-primary outline-none resize-y text-text"
            placeholder="Write your reflection here…"
          />
          <p className="mt-2 text-xs text-text-muted italic">
            Your reflections are not saved. Refreshing or leaving this page may discard them.
          </p>
        </div>

        {/* Warnings */}
        <div className="mb-6 space-y-1">
          <p className="text-xs text-text-muted">
            <span className="font-semibold">Note:</span> If you feel overwhelmed at any point, pause the exercise and take a break.
          </p>
        </div>

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            data-testid="next-step"
            onClick={handleNext}
            className="bg-primary text-white hover:bg-primary-light rounded-lg px-6 py-3 text-lg font-medium transition-colors order-1 sm:order-2"
          >
            {isLastStep ? 'Complete' : 'Next'}
          </button>

          {currentStep > 0 && (
            <button
              data-testid="prev-step"
              onClick={handlePrevious}
              className="border border-text/20 text-text hover:bg-text/5 rounded-lg px-6 py-3 text-lg font-medium transition-colors order-2 sm:order-1"
            >
              Previous
            </button>
          )}

          <button
            data-testid="skip-module"
            onClick={handleSkip}
            className="text-text-muted hover:text-text rounded-lg px-6 py-3 text-sm font-medium transition-colors order-3"
          >
            Skip this exercise
          </button>
        </div>

        <p className="mt-4 text-xs text-text-muted">
          Tip: Press <kbd className="px-1 py-0.5 bg-text/10 rounded text-xs font-mono">Ctrl</kbd>+<kbd className="px-1 py-0.5 bg-text/10 rounded text-xs font-mono">Enter</kbd> to advance to the next step.
        </p>
      </div>
    </Layout>
  );
}
