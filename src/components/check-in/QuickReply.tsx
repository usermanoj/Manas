'use client';

interface QuickReplyProps {
  options: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}

export function QuickReply({ options, onSelect, disabled }: QuickReplyProps): React.ReactNode {
  if (options.length === 0) return null;

  return (
    <div role="list" aria-label="Suggested replies">
      <p className="text-xs text-text-muted mb-2">Suggested replies</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            disabled={disabled}
            className="px-4 py-2 text-sm font-medium text-primary bg-primary/10 border border-primary/20 rounded-full hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            role="listitem"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
