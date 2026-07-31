import { BRAND } from '@/lib/config/brand';

interface ChatBubbleProps {
  message: string;
  isLoading?: boolean;
}

export function ChatBubble({ message, isLoading }: ChatBubbleProps): React.ReactNode {
  if (isLoading) {
    return (
      <div className="mt-4" data-testid="ai-response-loading" role="status" aria-label="Loading response">
        <div className="bg-surface rounded-xl shadow-sm border border-text/10 p-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4" data-testid="ai-response">
      <div className="bg-surface rounded-xl shadow-sm border border-text/10 p-4">
        <p className="text-xs font-medium text-primary mb-2">{BRAND.guideName}</p>
        <p className="text-text leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
