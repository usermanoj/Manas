'use client';

import { useRef, useEffect, useCallback } from 'react';

export interface OptionItem {
  value: string;
  label: string;
}

interface OptionSelectorProps {
  options: OptionItem[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
  stepName: string;
}

export function OptionSelector({ options, selectedValue, onSelect, stepName }: OptionSelectorProps): React.ReactNode {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let nextIndex = index;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        nextIndex = (index + 1) % options.length;
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        nextIndex = (index - 1 + options.length) % options.length;
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(options[index].value);
        return;
      } else {
        return;
      }
      refs.current[nextIndex]?.focus();
    },
    [options, onSelect],
  );

  useEffect(() => {
    const selectedIndex = options.findIndex((o) => o.value === selectedValue);
    if (selectedIndex >= 0) {
      refs.current[selectedIndex]?.focus();
    }
  }, [selectedValue, options]);

  return (
    <div className="space-y-2" role="radiogroup" aria-label="Select an option">
      {options.map((option, i) => {
        const isSelected = selectedValue === option.value;
        return (
          <button
            key={option.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            data-testid={`option-${stepName}-${option.value}`}
            onClick={() => onSelect(option.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={`w-full text-left px-5 py-4 rounded-lg border-2 transition-all duration-150 ${
              isSelected
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-surface text-text border-text/10 hover:border-primary hover:bg-primary/5'
            }`}
          >
            <span className="text-base font-medium">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
