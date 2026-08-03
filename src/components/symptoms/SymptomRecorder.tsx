'use client';

import { useState } from 'react';

export interface SymptomFormData {
  text: string;
  category: string;
  severity: string;
  frequency: string;
  impact: string;
}

interface SymptomRecorderProps {
  onSubmit: (data: SymptomFormData) => void;
  onCancel?: () => void;
  loading?: boolean;
}

const CATEGORIES = [
  { value: 'sleep', label: 'Sleep' },
  { value: 'mood', label: 'Mood' },
  { value: 'energy', label: 'Energy' },
  { value: 'focus', label: 'Focus' },
  { value: 'physical_tension', label: 'Physical tension' },
  { value: 'social', label: 'Social' },
  { value: 'work_stress', label: 'Work stress' },
  { value: 'other', label: 'Other' },
];

const SEVERITIES = [
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'significant', label: 'Significant' },
  { value: 'severe', label: 'Severe' },
];

const FREQUENCIES = [
  { value: 'occasionally', label: 'Occasionally' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'several_times_a_week', label: 'Several times a week' },
  { value: 'daily', label: 'Daily' },
  { value: 'constant', label: 'Constant' },
];

export function SymptomRecorder({ onSubmit, onCancel, loading }: SymptomRecorderProps): React.ReactNode {
  const [text, setText] = useState('');
  const [category, setCategory] = useState('other');
  const [severity, setSeverity] = useState('moderate');
  const [frequency, setFrequency] = useState('weekly');
  const [impact, setImpact] = useState('');

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    onSubmit({ text, category, severity, frequency, impact });
    setText('');
    setCategory('other');
    setSeverity('moderate');
    setFrequency('weekly');
    setImpact('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-text/10 rounded-xl p-5 space-y-4">
      <div>
        <label htmlFor="symptom-text" className="block text-sm font-medium text-text mb-1">
          What are you experiencing?
        </label>
        <input
          id="symptom-text"
          type="text"
          required
          maxLength={300}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. trouble falling asleep, racing thoughts..."
          className="w-full border border-text/20 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="symptom-category" className="block text-sm font-medium text-text mb-1">
            Category
          </label>
          <select
            id="symptom-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-text/20 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="symptom-severity" className="block text-sm font-medium text-text mb-1">
            Severity
          </label>
          <select
            id="symptom-severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full border border-text/20 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none"
          >
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="symptom-frequency" className="block text-sm font-medium text-text mb-1">
            Frequency
          </label>
          <select
            id="symptom-frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="w-full border border-text/20 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none"
          >
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="symptom-impact" className="block text-sm font-medium text-text mb-1">
          How is this affecting you?
        </label>
        <input
          id="symptom-impact"
          type="text"
          required
          maxLength={300}
          value={impact}
          onChange={(e) => setImpact(e.target.value)}
          placeholder="e.g. hard to concentrate at work"
          className="w-full border border-text/20 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-white hover:bg-primary-light rounded-lg px-5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving…' : 'Add to summary'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="border border-text/20 text-text hover:bg-surface rounded-lg px-5 py-2 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
