'use client';

interface QuickReplyProps {
  options: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}

/**
 * "You could say" prompts — shown beneath the companion message to help the
 * user articulate their experience. These are input shortcuts, NOT AI replies.
 * Clicking one pre-fills the chat input rather than sending immediately.
 */
export function QuickReply({ options, onSelect, disabled }: QuickReplyProps): React.ReactNode {
  if (options.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">
        You could say…
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            disabled={disabled}
            title="Click to use this as your reply"
            className="px-3 py-1.5 text-xs font-medium text-primary bg-primary/8 border border-primary/20 rounded-full hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
