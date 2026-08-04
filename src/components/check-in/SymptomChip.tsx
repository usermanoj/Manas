'use client';

import { useState } from 'react';
import type { InferredSymptomSuggestion } from '@/domain/ai';

type Severity = InferredSymptomSuggestion['severity'];

interface SymptomChipProps {
  symptom: InferredSymptomSuggestion;
  onRecord?: (symptom: InferredSymptomSuggestion) => void;
  disabled?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  sleep: 'Sleep',
  mood: 'Mood',
  energy: 'Energy',
  focus: 'Focus',
  physical_tension: 'Body',
  social: 'Social',
  work_stress: 'Work stress',
  other: 'Other',
};

const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'significant', label: 'Significant' },
  { value: 'severe', label: 'Severe' },
];

export function SymptomChip({ symptom, onRecord, disabled }: SymptomChipProps): React.ReactNode {
  const [selectedSeverity, setSelectedSeverity] = useState<Severity>(symptom.severity);
  const [recorded, setRecorded] = useState(symptom.userReported);

  const handleRecord = () => {
    if (recorded || disabled || !onRecord) return;
    setRecorded(true);
    onRecord({ ...symptom, severity: selectedSeverity, userReported: true });
  };

  return (
    <div className="inline-flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border bg-surface border-text/10 text-sm shadow-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium text-text">{symptom.text}</span>
        <span className="text-xs text-text-muted">{CATEGORY_LABELS[symptom.category] ?? symptom.category}</span>
      </div>

      <div
        className="flex items-center gap-1"
        role="group"
        aria-label={`How intense is ${symptom.text}?`}
      >
        {SEVERITY_OPTIONS.map((option) => {
          const isSelected = selectedSeverity === option.value && !recorded;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedSeverity(option.value)}
              disabled={recorded || disabled}
              aria-pressed={isSelected}
              className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                isSelected
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-text-muted border-text/10 hover:border-primary/50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {onRecord && (
        <button
          type="button"
          onClick={handleRecord}
          disabled={recorded || disabled}
          className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
            recorded
              ? 'bg-success text-white cursor-default'
              : 'bg-primary text-white hover:bg-primary-light disabled:opacity-50'
          }`}
        >
          {recorded ? 'Saved ✓' : 'Save'}
        </button>
      )}
    </div>
  );
}
