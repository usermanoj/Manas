'use client';

import { useState } from 'react';
import type { StructuredCheckIn } from '@/domain';

const DURATION_OPTIONS = [
  { value: 'days', label: 'A few days' },
  { value: 'weeks', label: 'A few weeks' },
  { value: 'months', label: 'Several months' },
  { value: 'over_year', label: 'Over a year' },
] as const;

const SLEEP_OPTIONS = [
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

interface FormFallbackProps {
  onSubmit: (data: StructuredCheckIn) => void;
}

export function FormFallback({ onSubmit }: FormFallbackProps): React.ReactNode {
  const [primaryConcern, setPrimaryConcern] = useState('');
  const [duration, setDuration] = useState('');
  const [sleepImpact, setSleepImpact] = useState('');
  const [functioning, setFunctioning] = useState('');
  const [support, setSupport] = useState('');
  const [safety, setSafety] = useState('');

  const isValid =
    primaryConcern.length >= 1 &&
    primaryConcern.length <= 1000 &&
    duration !== '' &&
    sleepImpact !== '' &&
    functioning !== '' &&
    support !== '' &&
    safety !== '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const keyPoints = primaryConcern
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 10);

    onSubmit({
      primary_concern: primaryConcern,
      concern_duration: duration as StructuredCheckIn['concern_duration'],
      sleep_impact: sleepImpact as StructuredCheckIn['sleep_impact'],
      daily_functioning_impact: functioning as StructuredCheckIn['daily_functioning_impact'],
      support_preference: support as StructuredCheckIn['support_preference'],
      feels_safe: safety as StructuredCheckIn['feels_safe'],
      key_points: keyPoints,
    });
  };

  const fieldsetClass = 'space-y-2';
  const legendClass = 'text-base font-medium text-text mb-2';
  const radioLabelClass = 'flex items-center gap-3 cursor-pointer py-1';

  return (
    <div data-testid="form-fallback" className="bg-surface rounded-xl shadow-sm border border-warning/30 p-6">
      <div className="mb-4 bg-warning/10 border border-warning/30 rounded-lg p-3">
        <p className="text-sm font-medium text-text">Offline form mode</p>
        <p className="text-xs text-text-muted">The server is unavailable. Your responses will be saved locally.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Q1: Primary concern */}
        <fieldset className={fieldsetClass}>
          <legend className={legendClass}>What has been feeling most difficult recently?</legend>
          <textarea
            value={primaryConcern}
            onChange={(e) => setPrimaryConcern(e.target.value)}
            maxLength={1000}
            placeholder="Share what has been on your mind…"
            className="w-full min-h-[100px] px-4 py-3 bg-background border border-text/20 rounded-lg text-text resize-y focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="text-xs text-text-muted">{primaryConcern.length}/1000</span>
        </fieldset>

        {/* Q2: Duration */}
        <fieldset className={fieldsetClass}>
          <legend className={legendClass}>How long has this been going on?</legend>
          {DURATION_OPTIONS.map((opt) => (
            <label key={opt.value} className={radioLabelClass}>
              <input type="radio" name="duration" value={opt.value} checked={duration === opt.value} onChange={() => setDuration(opt.value)} className="w-4 h-4 text-primary" />
              <span className="text-text">{opt.label}</span>
            </label>
          ))}
        </fieldset>

        {/* Q3: Sleep impact */}
        <fieldset className={fieldsetClass}>
          <legend className={legendClass}>How has this affected your sleep?</legend>
          {SLEEP_OPTIONS.map((opt) => (
            <label key={opt.value} className={radioLabelClass}>
              <input type="radio" name="sleep" value={opt.value} checked={sleepImpact === opt.value} onChange={() => setSleepImpact(opt.value)} className="w-4 h-4 text-primary" />
              <span className="text-text">{opt.label}</span>
            </label>
          ))}
        </fieldset>

        {/* Q4: Daily functioning */}
        <fieldset className={fieldsetClass}>
          <legend className={legendClass}>How has this affected your daily functioning?</legend>
          {FUNCTIONING_OPTIONS.map((opt) => (
            <label key={opt.value} className={radioLabelClass}>
              <input type="radio" name="functioning" value={opt.value} checked={functioning === opt.value} onChange={() => setFunctioning(opt.value)} className="w-4 h-4 text-primary" />
              <span className="text-text">{opt.label}</span>
            </label>
          ))}
        </fieldset>

        {/* Q5: Support preference */}
        <fieldset className={fieldsetClass}>
          <legend className={legendClass}>What kind of support are you looking for?</legend>
          {SUPPORT_OPTIONS.map((opt) => (
            <label key={opt.value} className={radioLabelClass}>
              <input type="radio" name="support" value={opt.value} checked={support === opt.value} onChange={() => setSupport(opt.value)} className="w-4 h-4 text-primary" />
              <span className="text-text">{opt.label}</span>
            </label>
          ))}
        </fieldset>

        {/* Q6: Safety */}
        <fieldset className={fieldsetClass}>
          <legend className={legendClass}>For this demonstration, do you feel safe right now?</legend>
          {SAFETY_OPTIONS.map((opt) => (
            <label key={opt.value} className={radioLabelClass}>
              <input type="radio" name="safety" value={opt.value} checked={safety === opt.value} onChange={() => setSafety(opt.value)} className="w-4 h-4 text-primary" />
              <span className="text-text">{opt.label}</span>
            </label>
          ))}
        </fieldset>

        <button
          type="submit"
          disabled={!isValid}
          className="w-full py-3 bg-primary text-white font-semibold rounded-lg transition-colors hover:bg-primary-light disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary"
        >
          Complete Check-In
        </button>
      </form>
    </div>
  );
}
