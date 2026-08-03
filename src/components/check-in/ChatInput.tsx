'use client';

import { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  maxLength?: number;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Type your message…',
  maxLength = 1000,
  isLoading,
  disabled,
}: ChatInputProps): React.ReactNode {
  const [touched, setTouched] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const charCount = value.length;
  const isValid = charCount >= 1 && charCount <= maxLength;
  const showError = touched && charCount > maxLength;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isValid && !isLoading && !disabled) {
        onSubmit();
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2 bg-surface border border-text/20 rounded-2xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:border-primary">
        <textarea
          ref={textareaRef}
          data-testid="chat-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength + 100}
          disabled={disabled || isLoading}
          rows={1}
          className="flex-1 max-h-40 px-3 py-2 bg-transparent text-text placeholder:text-text-muted resize-none focus:outline-none disabled:opacity-60"
          aria-label="Type your check-in message"
        />
        <button
          data-testid="chat-submit"
          type="button"
          disabled={!isValid || isLoading || disabled}
          onClick={onSubmit}
          className="shrink-0 px-4 py-2 bg-primary text-white font-medium rounded-xl transition-colors hover:bg-primary-light disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {isLoading ? 'Sending…' : 'Send'}
        </button>
      </div>

      <div className="flex items-center justify-between px-1">
        <span className={`text-xs ${showError ? 'text-error' : 'text-text-muted'}`}>
          {charCount}/{maxLength}
        </span>
        {showError && (
          <p className="text-xs text-error" role="alert">
            Message must be {maxLength} characters or fewer.
          </p>
        )}
      </div>
    </div>
  );
}
