'use client';

import { BRAND } from '@/lib/config/brand';
import type { PostMessageResponse } from '@/domain/ai';
import { TechniqueCard } from './TechniqueCard';
import { SymptomChip } from './SymptomChip';
import { QuickReply } from './QuickReply';

interface CompanionMessageProps {
  response: PostMessageResponse;
  onQuickReply?: (text: string) => void;
  onRecordSymptom?: (symptom: PostMessageResponse['inferredSymptoms'][number]) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function CompanionMessage({
  response,
  onQuickReply,
  onRecordSymptom,
  isLoading,
  disabled,
}: CompanionMessageProps): React.ReactNode {
  if (isLoading) {
    return (
      <div className="mt-4" data-testid="ai-response-loading" role="status" aria-label="Loading response">
        <div className="bg-surface rounded-xl shadow-sm border border-text/10 p-4 max-w-3xl">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  const hasSafetyFlag = response.safetyFlag && response.safetyMessage;

  return (
    <div className="mt-4" data-testid="ai-response">
      <div className={`bg-surface rounded-xl shadow-sm border p-4 max-w-3xl ${hasSafetyFlag ? 'border-error/30 bg-error/5' : 'border-text/10'}`}>
        <p className="text-xs font-medium text-primary mb-2">{BRAND.guideName}</p>

        {hasSafetyFlag && (
          <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-text">
            {response.safetyMessage}
          </div>
        )}

        <div className="text-text leading-relaxed whitespace-pre-wrap">
          {response.userFacingResponse}
        </div>

        {response.crossSessionInsight && (
          <div className="mt-4 p-3 bg-secondary/10 border border-secondary/20 rounded-lg text-sm text-text">
            <span className="font-medium">Pattern note:</span> {response.crossSessionInsight}
          </div>
        )}

        {response.techniques.length > 0 && (
          <div className="mt-4 space-y-3">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Suggested techniques</p>
            {response.techniques.map((technique) => (
              <TechniqueCard key={technique.id} technique={technique} />
            ))}
          </div>
        )}

        {response.inferredSymptoms.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Noted symptoms</p>
            <div className="flex flex-wrap gap-2">
              {response.inferredSymptoms.map((symptom, index) => (
                <SymptomChip
                  key={`${symptom.text}-${index}`}
                  symptom={symptom}
                  onRecord={onRecordSymptom}
                  disabled={disabled}
                />
              ))}
            </div>
          </div>
        )}

        {response.citations.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Sources</p>
            <div className="flex flex-wrap gap-2">
              {response.citations.map((citation, index) => (
                <div key={index} className="text-xs">
                  {citation.url ? (
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary-light underline underline-offset-2"
                    >
                      {citation.title || citation.source}
                    </a>
                  ) : (
                    <span className="text-text">{citation.title || citation.source}</span>
                  )}
                  {citation.year && <span className="text-text-muted"> ({citation.year})</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {response.followUpQuestions.length > 0 && onQuickReply && (
          <QuickReply
            options={response.followUpQuestions.slice(0, 3)}
            onSelect={onQuickReply}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}
