'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BRAND } from '@/lib/config/brand';

interface ModuleStep {
  order: number;
  instruction: string;
  durationSeconds: number;
}

interface ModuleData {
  id: string;
  title: string;
  purpose: string;
  status: string;
  steps: ModuleStep[];
  warnings: string[];
  contraindications: string[];
  escalationConditions: string[];
  reviewStatus: string;
}

type Phase = 'intro' | 'running' | 'complete';

export function PauseReflectRunner({ module: mod }: { module: ModuleData }): React.ReactNode {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('intro');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [reflection, setReflection] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentStep = mod.steps[currentStepIndex];
  const totalSteps = mod.steps.length;
  const isLastStep = currentStepIndex === totalSteps - 1;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const startTimer = useCallback((duration: number) => {
    clearTimer();
    setSecondsLeft(duration);
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimer]);

  const handleBegin = (): void => {
    setPhase('running');
    setCurrentStepIndex(0);
    startTimer(mod.steps[0].durationSeconds);
  };

  const handleNext = (): void => {
    if (isLastStep) {
      clearTimer();
      setPhase('complete');
    } else {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      startTimer(mod.steps[nextIndex].durationSeconds);
    }
  };

  const handleSkip = (): void => {
    clearTimer();
    handleNext();
  };

  const handleRestart = (): void => {
    setPhase('intro');
    setCurrentStepIndex(0);
    setReflection('');
    setSecondsLeft(0);
  };

  const formatTime = (s: number): string => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const progressPercent = phase === 'running'
    ? Math.round(((currentStepIndex) / totalSteps) * 100)
    : phase === 'complete' ? 100 : 0;

  return (
    <>
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className={`${BRAND.typography.headingSize} font-semibold text-text`}>
            {mod.title}
          </h1>
        </div>

        {/* Progress bar */}
        {phase !== 'intro' && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span>
                {phase === 'running' ? `Step ${currentStepIndex + 1} of ${totalSteps}` : 'Complete'}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-text/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-in-out rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Intro Phase ── */}
        {phase === 'intro' && (
          <div className="space-y-6">
            <div className="bg-surface border border-text/10 rounded-lg p-6">
              <h2 className="text-lg font-medium text-text mb-2">About this exercise</h2>
              <p className="text-text-muted">{mod.purpose}</p>
            </div>

            {mod.warnings.length > 0 && (
              <div className="bg-warning/5 border border-warning/30 rounded-lg p-5">
                <h3 className="text-sm font-medium text-text mb-2">Before you begin</h3>
                <ul className="space-y-1">
                  {mod.warnings.map((w, i) => (
                    <li key={i} className="text-sm text-text-muted flex gap-2">
                      <span className="text-warning flex-shrink-0">&#9888;</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {mod.contraindications.length > 0 && (
              <div className="bg-error/5 border border-error/20 rounded-lg p-5">
                <h3 className="text-sm font-medium text-text mb-2">This exercise may not be suitable if</h3>
                <ul className="space-y-1">
                  {mod.contraindications.map((c, i) => (
                    <li key={i} className="text-sm text-text-muted flex gap-2">
                      <span className="text-error flex-shrink-0">&#10006;</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-surface border border-text/10 rounded-lg p-5">
              <h3 className="text-sm font-medium text-text mb-2">What to expect</h3>
              <ol className="space-y-2">
                {mod.steps.map((step) => (
                  <li key={step.order} className="text-sm text-text-muted flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                      {step.order}
                    </span>
                    <span className="flex-1">
                      {step.instruction}
                      <span className="text-xs text-text-muted ml-2">
                        ({Math.round(step.durationSeconds / 60 * 10) / 10} min)
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <button
              type="button"
              onClick={handleBegin}
              className="w-full py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Begin Exercise
            </button>
          </div>
        )}

        {/* ── Running Phase ── */}
        {phase === 'running' && currentStep && (
          <div className="space-y-6">
            <div className="bg-surface border border-text/10 rounded-lg p-8 text-center">
              <div className="mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  Step {currentStep.order} of {totalSteps}
                </span>
              </div>

              <p className={`${BRAND.typography.bodySize} text-text leading-relaxed mb-8`}>
                {currentStep.instruction}
              </p>

              {/* Timer */}
              <div className="mb-6">
                <div className={`text-4xl font-light ${secondsLeft === 0 ? 'text-success' : 'text-primary'} transition-colors`}>
                  {formatTime(secondsLeft)}
                </div>
                {secondsLeft === 0 && (
                  <p className="text-sm text-success mt-2 font-medium">
                    Time&rsquo;s up &mdash; continue when ready
                  </p>
                )}
              </div>

              {/* Reflection textarea on last step */}
              {isLastStep && (
                <div className="text-left mb-6">
                  <label htmlFor="reflection" className="block text-sm font-medium text-text mb-2">
                    Your reflection
                  </label>
                  <textarea
                    id="reflection"
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    rows={4}
                    placeholder="Write one sentence about what came up for you..."
                    className="w-full rounded-lg border border-text/20 bg-background p-3 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  />
                </div>
              )}

              <div className="flex items-center justify-center gap-3">
                {!isLastStep && (
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="px-5 py-2 border border-text/20 text-text-muted rounded-lg hover:bg-text/5 transition-colors text-sm"
                  >
                    Skip
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
                >
                  {isLastStep ? 'Finish' : 'Next Step'}
                </button>
              </div>
            </div>

            {/* Escalation notice */}
            {mod.escalationConditions.length > 0 && (
              <div className="bg-error/5 border border-error/20 rounded-lg p-4">
                <p className="text-xs text-text-muted">
                  <span className="font-medium text-text">Note:</span>{' '}
                  If you feel unsafe, experience severe distress, or dissociation, please pause and reach out to a trusted person or crisis helpline.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Complete Phase ── */}
        {phase === 'complete' && (
          <div className="space-y-6">
            <div className="bg-surface border border-text/10 rounded-lg p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-text mb-2">Exercise Complete</h2>
              <p className="text-text-muted">
                Thank you for taking a moment to pause and reflect.
              </p>
            </div>

            {reflection && (
              <div className="bg-surface border border-text/10 rounded-lg p-5">
                <h3 className="text-sm font-medium text-text mb-2">Your reflection</h3>
                <p className="text-sm text-text-muted italic">&ldquo;{reflection}&rdquo;</p>
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleRestart}
                className="px-5 py-2 border border-text/20 text-text-muted rounded-lg hover:bg-text/5 transition-colors text-sm"
              >
                Repeat Exercise
              </button>
              <button
                type="button"
                onClick={() => router.push('/professionals')}
                className="px-6 py-2 border border-primary text-primary font-medium rounded-lg hover:bg-primary/5 transition-colors"
              >
                Next: Browse Professionals
              </button>
              <Link
                href="/"
                className="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                Back to Home
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
