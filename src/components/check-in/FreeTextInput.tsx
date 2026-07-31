'use client';

import { useState } from 'react';

interface FreeTextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  maxLength?: number;
  isLoading?: boolean;
  disabled?: boolean;
}

export function FreeTextInput({
  value,
  onChange,
  onSubmit,
  maxLength = 1000,
  isLoading,
  disabled,
}: FreeTextInputProps): React.ReactNode {
  const [touched, setTouched] = useState(false);
  const charCount = value.length;
  const isValid = charCount >= 1 && charCount <= maxLength;
  const showError = touched && charCount > maxLength;

  return (
    <div className="space-y-2">
      <textarea
        data-testid="primary-concern-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder="Share what has been on your mind…"
        maxLength={maxLength + 100}
        disabled={disabled || isLoading}
        className="w-full min-h-[120px] px-4 py-3 bg-surface border border-text/20 rounded-lg text-text placeholder:text-text-muted resize-y focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-60"
        aria-label="Describe what has been feeling most difficult recently"
      />

      <div className="flex items-center justify-between">
        <span className={`text-xs ${showError ? 'text-error' : 'text-text-muted'}`}>
          {charCount}/{maxLength}
        </span>
        <button
          data-testid="primary-concern-submit"
          type="button"
          disabled={!isValid || isLoading || disabled}
          onClick={onSubmit}
          className="px-5 py-2 bg-primary text-white font-medium rounded-lg transition-colors hover:bg-primary-light disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {isLoading ? 'Sending…' : 'Submit'}
        </button>
      </div>

      {showError && (
        <p className="text-xs text-error" role="alert">
          Response must be {maxLength} characters or fewer.
        </p>
      )}
    </div>
  );
}
