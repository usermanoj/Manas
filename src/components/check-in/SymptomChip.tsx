'use client';

import { useState } from 'react';
import type { InferredSymptomSuggestion } from '@/domain/ai';

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

const SEVERITY_CLASSES: Record<string, string> = {
  mild: 'bg-success/10 text-success border-success/30',
  moderate: 'bg-warning/10 text-warning border-warning/30',
  significant: 'bg-accent/20 text-text border-accent/40',
  severe: 'bg-error/10 text-error border-error/30',
};

export function SymptomChip({ symptom, onRecord, disabled }: SymptomChipProps): React.ReactNode {
  const [recorded, setRecorded] = useState(symptom.userReported);

  const handleRecord = () => {
    if (recorded || disabled || !onRecord) return;
    setRecorded(true);
    onRecord(symptom);
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
        SEVERITY_CLASSES[symptom.severity] ?? 'bg-surface border-text/10 text-text'
      }`}
    >
      <span className="font-medium">{symptom.text}</span>
      <span className="text-xs opacity-80">{CATEGORY_LABELS[symptom.category] ?? symptom.category}</span>
      <span className="text-xs opacity-80 capitalize">{symptom.severity}</span>
      {onRecord && (
        <button
          type="button"
          onClick={handleRecord}
          disabled={recorded || disabled}
          className={`ml-1 text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${
            recorded
              ? 'bg-success text-white cursor-default'
              : 'bg-primary text-white hover:bg-primary-light disabled:opacity-50'
          }`}
        >
          {recorded ? 'Recorded' : 'Record'}
        </button>
      )}
    </div>
  );
}
