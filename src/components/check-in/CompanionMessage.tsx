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
        <div className="bg-surface rounded-2xl shadow-sm border border-text/10 p-4 max-w-3xl">
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
  const hasTechniques = response.techniques.length > 0;
  const hasSymptoms = response.inferredSymptoms.length > 0;
  const hasQuickReplies = response.followUpQuestions.length > 0 && onQuickReply;

  return (
    <div className="mt-4" data-testid="ai-response">
      <div
        className={`bg-surface rounded-2xl shadow-sm border p-5 max-w-3xl ${
          hasSafetyFlag ? 'border-error/30 bg-error/5' : 'border-text/10'
        }`}
      >
        {hasSafetyFlag && (
          <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-text">
            {response.safetyMessage}
          </div>
        )}

        <p className="text-sm font-medium text-primary mb-2">{BRAND.guideName}</p>

        <div className="text-text leading-relaxed whitespace-pre-wrap">
          {response.userFacingResponse}
        </div>

        {hasTechniques && (
          <div className="mt-5 space-y-3">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Suggested techniques</p>
            {response.techniques.map((technique) => (
              <TechniqueCard key={technique.id} technique={technique} />
            ))}
          </div>
        )}

        {hasSymptoms && (
          <div className="mt-5 space-y-2">
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
            <p className="text-xs text-text-muted">
              Tap &quot;Record&quot; to save a symptom to your profile. You can review or delete these in Privacy.
            </p>
          </div>
        )}

        {hasQuickReplies && (
          <div className="mt-5 pt-4 border-t border-text/10">
            <QuickReply
              options={response.followUpQuestions.slice(0, 3)}
              onSelect={onQuickReply}
              disabled={disabled}
            />
          </div>
        )}

        <p className="mt-4 text-xs text-text-muted">
          {BRAND.prototypeLabel}
        </p>
      </div>
    </div>
  );
}
