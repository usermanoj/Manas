'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/Layout';
import { BRAND } from '@/lib/config/brand';
import type { StructuredCheckIn } from '@/domain/ai/schemas';
import type { Provider } from '@/domain/repositories/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = [
  'review_provider',
  'edit_fields',
  'exclude_fields',
  'add_note',
  'preview',
  'save_draft',
  'submitted',
] as const;
type Step = (typeof STEPS)[number];

const DURATION_OPTIONS = [
  { value: 'days', label: 'A few days' },
  { value: 'weeks', label: 'A few weeks' },
  { value: 'months', label: 'Several months' },
  { value: 'over_year', label: 'Over a year' },
] as const;

const SLEEP_IMPACT_OPTIONS = [
  { value: 'none', label: 'No impact' },
  { value: 'mild', label: 'Mild impact' },
  { value: 'significant', label: 'Significant impact' },
  { value: 'severe', label: 'Severe impact' },
] as const;

const FUNCTIONING_OPTIONS = [
  { value: 'none', label: 'No impact' },
  { value: 'mild', label: 'Mild impact' },
  { value: 'moderate', label: 'Moderate impact' },
  { value: 'significant', label: 'Significant impact' },
] as const;

const SUPPORT_OPTIONS = [
  { value: 'general_reflection', label: 'General reflection' },
  { value: 'professional_support', label: 'Professional support' },
  { value: 'immediate_resources', label: 'Immediate resources' },
] as const;

const SAFETY_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'prefer_not_to_answer', label: 'Prefer not to answer' },
] as const;

const FIELD_LABELS: Record<string, string> = {
  primary_concern: 'Primary concern',
  concern_duration: 'Duration',
  sleep_impact: 'Sleep impact',
  daily_functioning_impact: 'Daily functioning impact',
  support_preference: 'Support preference',
  feels_safe: 'Safety response',
  key_points: 'Key points',
};

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

interface FieldCardProps {
  label: string;
  children: React.ReactNode;
  note?: string;
}

function FieldCard({ label, children, note }: FieldCardProps): React.ReactNode {
  return (
    <div className="bg-surface rounded-xl shadow-sm p-6">
      <label className="block text-sm font-semibold text-text mb-3">{label}</label>
      {children}
      {note && <p className="mt-2 text-xs text-text-muted italic">{note}</p>}
    </div>
  );
}

interface RadioGroupProps {
  name: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

function RadioGroup({ name, value, options, onChange }: RadioGroupProps): React.ReactNode {
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="w-4 h-4 text-primary"
          />
          <span className="text-text">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

function labelForEnum(field: string, value: string): string {
  const map: Record<string, ReadonlyArray<{ value: string; label: string }>> = {
    concern_duration: DURATION_OPTIONS,
    sleep_impact: SLEEP_IMPACT_OPTIONS,
    daily_functioning_impact: FUNCTIONING_OPTIONS,
    support_preference: SUPPORT_OPTIONS,
    feels_safe: SAFETY_OPTIONS,
  };
  const opts = map[field];
  if (!opts) return value;
  return opts.find((o) => o.value === value)?.label ?? value;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function HandoffPage(): React.ReactNode {
  // Gate data
  const [provider, setProvider] = useState<Provider | null>(null);
  const [summary, setSummary] = useState<StructuredCheckIn | null>(null);
  const [gateReady, setGateReady] = useState(false);

  // Wizard state
  const [step, setStep] = useState<Step>('review_provider');
  const [formData, setFormData] = useState<StructuredCheckIn | null>(null);
  const [excludedFields, setExcludedFields] = useState<string[]>(['feels_safe']);
  const [userNote, setUserNote] = useState('');
  const [handoffId, setHandoffId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load gate data from sessionStorage
  useEffect(() => {
    try {
      const providerJson = sessionStorage.getItem('manas-selected-provider');
      const summaryJson = sessionStorage.getItem('manas-confirmed-summary');
      if (providerJson) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage hydration requires setState in effect
        setProvider(JSON.parse(providerJson) as Provider);
      }
      if (summaryJson) {
        const parsed = JSON.parse(summaryJson) as StructuredCheckIn;
        setSummary(parsed);
        setFormData(parsed);
      }
    } catch {
      // ignore parse errors
    } finally {
      setGateReady(true);
    }
  }, []);

  // Form helpers
  const updateField = <K extends keyof StructuredCheckIn>(key: K, value: StructuredCheckIn[K]): void => {
    setFormData((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateKeyPoint = (index: number, value: string): void => {
    setFormData((prev) => {
      if (!prev) return prev;
      const updated = [...prev.key_points];
      updated[index] = value;
      return { ...prev, key_points: updated };
    });
  };

  const addKeyPoint = (): void => {
    setFormData((prev) => {
      if (!prev || prev.key_points.length >= 10) return prev;
      return { ...prev, key_points: [...prev.key_points, ''] };
    });
  };

  const removeKeyPoint = (index: number): void => {
    setFormData((prev) => {
      if (!prev) return prev;
      return { ...prev, key_points: prev.key_points.filter((_, i) => i !== index) };
    });
  };

  const toggleExcluded = (fieldKey: string): void => {
    setExcludedFields((prev) =>
      prev.includes(fieldKey) ? prev.filter((f) => f !== fieldKey) : [...prev, fieldKey],
    );
  };

  const stepIndex = STEPS.indexOf(step);
  const goBack = (): void => {
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1]);
  };
  const goNext = (): void => {
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]);
  };

  // Save draft
  const handleSaveDraft = async (): Promise<void> => {
    if (!provider || !formData) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/handoffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: provider.id,
          structuredSummary: formData,
          excludedEntries: excludedFields,
          userNote: userNote || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to save draft.');
      const data = (await res.json()) as { handoff: { id: string } };
      setHandoffId(data.handoff.id);
      goNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  // Submit for review
  const handleSubmitForReview = async (): Promise<void> => {
    if (!handoffId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/handoffs/${handoffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_for_review' }),
      });
      if (!res.ok) throw new Error('Failed to submit for review.');
      goNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Gate: missing data ---
  if (!gateReady) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-12">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!provider) {
    return (
      <Layout>
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding} text-center`}>
          <p className="text-text-muted text-lg mb-4">No provider selected. Please choose a professional first.</p>
          <Link href="/professionals" className="text-primary hover:underline font-medium">
            Browse Professionals
          </Link>
        </div>
      </Layout>
    );
  }

  if (!summary || !formData) {
    return (
      <Layout>
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding} text-center`}>
          <p className="text-text-muted text-lg mb-4">No confirmed summary found. Please complete the check-in first.</p>
          <Link href="/check-in" className="text-primary hover:underline font-medium">
            Start a Check-In
          </Link>
        </div>
      </Layout>
    );
  }

  // All editable field keys for exclusion step
  const allFieldKeys = [
    'primary_concern',
    'concern_duration',
    'sleep_impact',
    'daily_functioning_impact',
    'support_preference',
    'feels_safe',
    'key_points',
  ];

  // Preview helpers
  const previewFields: Record<string, unknown> = {
    primary_concern: formData.primary_concern,
    concern_duration: formData.concern_duration,
    sleep_impact: formData.sleep_impact,
    daily_functioning_impact: formData.daily_functioning_impact,
    support_preference: formData.support_preference,
    feels_safe: formData.feels_safe,
    key_points: formData.key_points,
  };

  return (
    <Layout>
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        {/* Fictional demo disclaimer */}
        <div className="bg-secondary/10 border border-secondary/30 rounded-lg p-3 mb-6 text-sm text-text-muted text-center">
          Fictional Demo Profile — this is a synthetic demonstration. No real clinician is involved.
        </div>

        {/* Step indicator */}
        {step !== 'submitted' && (
          <div className="flex items-center gap-2 mb-8 overflow-x-auto">
            {STEPS.filter((s) => s !== 'submitted').map((s, i) => (
              <div
                key={s}
                className={`flex items-center gap-1 text-xs whitespace-nowrap ${
                  i < stepIndex
                    ? 'text-success font-medium'
                    : i === stepIndex
                      ? 'text-primary font-semibold'
                      : 'text-text-muted'
                }`}
              >
                <span className="w-6 h-6 flex items-center justify-center rounded-full border text-xs
                  {i < stepIndex ? 'bg-success text-white border-success' : i === stepIndex ? 'border-primary text-primary' : 'border-text/30 text-text-muted'}">
                  {i < stepIndex ? '✓' : i + 1}
                </span>
                <span className="hidden sm:inline">{FIELD_LABELS[s] ?? s.replace(/_/g, ' ')}</span>
                {i < STEPS.filter((x) => x !== 'submitted').length - 1 && <span className="text-text/20 mx-1">|</span>}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-error/10 border border-error/30 rounded-lg p-4 mb-6">
            <p className="text-error font-medium">{error}</p>
          </div>
        )}

        {/* ─── Step: Review Provider ─── */}
        {step === 'review_provider' && (
          <div>
            <h1 className={`${BRAND.typography.headingSize} font-semibold text-text mb-2`}>Review Provider</h1>
            <p className="text-text-muted mb-6">Confirm the professional you&apos;d like to share your summary with.</p>

            <div className="bg-surface rounded-xl shadow-sm p-6 mb-6">
              <h2 className="text-xl font-semibold text-text mb-1">{provider.name}</h2>
              <p className="text-text-muted mb-3">{provider.title}</p>
              <div className="space-y-2 text-sm text-text">
                <p><span className="font-semibold">Languages:</span> {provider.languages.join(', ')}</p>
                <p><span className="font-semibold">Focus areas:</span> {provider.focusAreas.join(', ')}</p>
                <p><span className="font-semibold">Availability:</span> {provider.availability}</p>
                <p><span className="font-semibold">Session type:</span> {provider.sessionType}</p>
                <p><span className="font-semibold">Price range:</span> {provider.priceRange}</p>
              </div>
              {provider.bio && <p className="mt-4 text-text-muted text-sm">{provider.bio}</p>}
            </div>

            <div className="flex justify-end">
              <button
                onClick={goNext}
                className="bg-primary text-white hover:bg-primary-light rounded-lg px-6 py-3 font-medium transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ─── Step: Edit Fields ─── */}
        {step === 'edit_fields' && (
          <div>
            <h1 className={`${BRAND.typography.headingSize} font-semibold text-text mb-2`}>Edit Fields</h1>
            <p className="text-text-muted mb-6">Review and edit the information that will be shared.</p>

            <div className="space-y-6">
              <FieldCard label="Primary concern">
                <input
                  type="text"
                  value={formData.primary_concern}
                  onChange={(e) => updateField('primary_concern', e.target.value)}
                  className="w-full border border-text/20 rounded-lg p-2 focus:ring-2 focus:ring-primary outline-none"
                  maxLength={200}
                />
              </FieldCard>

              <FieldCard label="Duration">
                <RadioGroup
                  name="handoff-concern_duration"
                  value={formData.concern_duration}
                  options={DURATION_OPTIONS}
                  onChange={(v) => updateField('concern_duration', v as StructuredCheckIn['concern_duration'])}
                />
              </FieldCard>

              <FieldCard label="Sleep impact">
                <RadioGroup
                  name="handoff-sleep_impact"
                  value={formData.sleep_impact}
                  options={SLEEP_IMPACT_OPTIONS}
                  onChange={(v) => updateField('sleep_impact', v as StructuredCheckIn['sleep_impact'])}
                />
              </FieldCard>

              <FieldCard label="Daily functioning impact">
                <RadioGroup
                  name="handoff-daily_functioning_impact"
                  value={formData.daily_functioning_impact}
                  options={FUNCTIONING_OPTIONS}
                  onChange={(v) => updateField('daily_functioning_impact', v as StructuredCheckIn['daily_functioning_impact'])}
                />
              </FieldCard>

              <FieldCard label="Support preference">
                <RadioGroup
                  name="handoff-support_preference"
                  value={formData.support_preference}
                  options={SUPPORT_OPTIONS}
                  onChange={(v) => updateField('support_preference', v as StructuredCheckIn['support_preference'])}
                />
              </FieldCard>

              <FieldCard label="Safety response" note="This is your direct response, not an AI assessment.">
                <RadioGroup
                  name="handoff-feels_safe"
                  value={formData.feels_safe}
                  options={SAFETY_OPTIONS}
                  onChange={(v) => updateField('feels_safe', v as StructuredCheckIn['feels_safe'])}
                />
              </FieldCard>

              <FieldCard label="Key points">
                <div className="space-y-2">
                  {formData.key_points.map((point, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={point}
                        onChange={(e) => updateKeyPoint(i, e.target.value)}
                        className="flex-1 border border-text/20 rounded-lg p-2 focus:ring-2 focus:ring-primary outline-none"
                      />
                      <button
                        onClick={() => removeKeyPoint(i)}
                        className="text-error hover:text-error/80 px-2 text-sm font-medium"
                        aria-label={`Remove key point ${i + 1}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {formData.key_points.length < 10 && (
                    <button
                      onClick={addKeyPoint}
                      className="text-primary hover:text-primary-light text-sm font-medium mt-2"
                    >
                      + Add key point
                    </button>
                  )}
                </div>
              </FieldCard>
            </div>

            <div className="flex justify-between mt-8">
              <button onClick={goBack} className="text-primary hover:underline font-medium px-4 py-3">
                Back
              </button>
              <button
                onClick={goNext}
                className="bg-primary text-white hover:bg-primary-light rounded-lg px-6 py-3 font-medium transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ─── Step: Exclude Fields ─── */}
        {step === 'exclude_fields' && (
          <div>
            <h1 className={`${BRAND.typography.headingSize} font-semibold text-text mb-2`}>Choose What to Share</h1>
            <p className="text-text-muted mb-6">Uncheck any field you&apos;d like to exclude from the handoff.</p>

            <div className="space-y-3">
              {allFieldKeys.map((key) => (
                <label key={key} className="flex items-center gap-3 bg-surface rounded-lg p-4 shadow-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!excludedFields.includes(key)}
                    onChange={() => toggleExcluded(key)}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-text font-medium">{FIELD_LABELS[key] ?? key}</span>
                  {excludedFields.includes(key) && (
                    <span className="ml-auto text-xs text-text-muted italic">Excluded</span>
                  )}
                </label>
              ))}
            </div>

            <div className="flex justify-between mt-8">
              <button onClick={goBack} className="text-primary hover:underline font-medium px-4 py-3">
                Back
              </button>
              <button
                onClick={goNext}
                className="bg-primary text-white hover:bg-primary-light rounded-lg px-6 py-3 font-medium transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ─── Step: Add Note ─── */}
        {step === 'add_note' && (
          <div>
            <h1 className={`${BRAND.typography.headingSize} font-semibold text-text mb-2`}>Add a Note</h1>
            <p className="text-text-muted mb-6">Optionally add a personal note to include with your handoff.</p>

            <div className="bg-surface rounded-xl shadow-sm p-6">
              <textarea
                value={userNote}
                onChange={(e) => setUserNote(e.target.value.slice(0, 500))}
                placeholder="Add anything you'd like your provider to know…"
                rows={5}
                className="w-full border border-text/20 rounded-lg p-3 focus:ring-2 focus:ring-primary outline-none resize-none"
              />
              <p className="text-right text-xs text-text-muted mt-1">{userNote.length}/500</p>
            </div>

            <div className="flex justify-between mt-8">
              <button onClick={goBack} className="text-primary hover:underline font-medium px-4 py-3">
                Back
              </button>
              <button
                onClick={goNext}
                className="bg-primary text-white hover:bg-primary-light rounded-lg px-6 py-3 font-medium transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ─── Step: Preview ─── */}
        {step === 'preview' && (
          <div>
            <h1 className={`${BRAND.typography.headingSize} font-semibold text-text mb-2`}>Preview</h1>
            <p className="text-text-muted mb-6">This is what would be shared with {provider.name}.</p>

            <div className="space-y-4">
              {allFieldKeys.map((key) => {
                if (excludedFields.includes(key)) {
                  return (
                    <div key={key} className="bg-surface/50 rounded-xl shadow-sm p-6 opacity-50">
                      <p className="text-sm font-semibold text-text-muted line-through">{FIELD_LABELS[key]}</p>
                      <p className="text-xs text-text-muted italic mt-1">Excluded</p>
                    </div>
                  );
                }

                const value = previewFields[key];
                if (key === 'key_points' && Array.isArray(value)) {
                  return (
                    <FieldCard key={key} label={FIELD_LABELS[key]}>
                      <ul className="list-disc list-inside space-y-1">
                        {(value as string[]).map((pt, i) => (
                          <li key={i} className="text-text">{pt}</li>
                        ))}
                      </ul>
                    </FieldCard>
                  );
                }

                const displayValue = typeof value === 'string' ? labelForEnum(key, value) || value : String(value);
                return (
                  <FieldCard key={key} label={FIELD_LABELS[key]}>
                    <p className="text-text">{displayValue}</p>
                  </FieldCard>
                );
              })}

              {userNote && (
                <FieldCard label="Your note">
                  <p className="text-text whitespace-pre-wrap">{userNote}</p>
                </FieldCard>
              )}
            </div>

            <div className="flex justify-between mt-8">
              <button onClick={goBack} className="text-primary hover:underline font-medium px-4 py-3">
                Back
              </button>
              <button
                onClick={goNext}
                className="bg-primary text-white hover:bg-primary-light rounded-lg px-6 py-3 font-medium transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ─── Step: Save Draft ─── */}
        {step === 'save_draft' && (
          <div>
            <h1 className={`${BRAND.typography.headingSize} font-semibold text-text mb-2`}>Save Draft</h1>
            <p className="text-text-muted mb-6">Save your handoff as a draft. You can submit it for review when ready.</p>

            <div className="bg-surface rounded-xl shadow-sm p-6 mb-6">
              <p className="text-text text-sm">
                Provider: <span className="font-semibold">{provider.name}</span>
              </p>
              <p className="text-text text-sm mt-1">
                Fields included: <span className="font-semibold">{allFieldKeys.length - excludedFields.length}</span> of {allFieldKeys.length}
              </p>
              {userNote && (
                <p className="text-text text-sm mt-1">
                  Note: <span className="font-semibold">{userNote.length} characters</span>
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="bg-primary text-white hover:bg-primary-light rounded-lg px-6 py-3 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-1"
              >
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button onClick={goBack} className="text-primary hover:underline font-medium px-4 py-3">
                Back
              </button>
            </div>
          </div>
        )}

        {/* ─── Step: Submitted ─── */}
        {step === 'submitted' && (
          <div className="text-center py-8">
            <div className="flex justify-center mb-4">
              <svg className="w-12 h-12 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className={`${BRAND.typography.headingSize} font-semibold text-text mb-2`}>
              Handoff Ready for Review
            </h1>
            <p className="text-text-muted mb-8">
              Your handoff has been saved and submitted for review. You will be notified when it has been reviewed.
            </p>
            <Link
              href="/"
              className="bg-primary text-white hover:bg-primary-light rounded-lg px-6 py-3 font-medium transition-colors inline-block"
            >
              Back to Home
            </Link>
          </div>
        )}

        {/* ─── Submit for review (shown on save_draft step after save) ─── */}
        {step === 'save_draft' && handoffId && !error && (
          <div className="mt-8 bg-primary/10 border border-primary/30 rounded-lg p-6 text-center">
            <p className="text-text font-medium mb-4">Draft saved successfully.</p>
            <button
              onClick={handleSubmitForReview}
              disabled={submitting}
              className="bg-primary text-white hover:bg-primary-light rounded-lg px-6 py-3 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting…' : 'Submit for Review'}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
