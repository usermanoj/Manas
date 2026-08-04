'use client';

import { BRAND } from '@/lib/config/brand';
import type { PostMessageResponse } from '@/domain/ai';
import { TechniqueCard } from './TechniqueCard';
import { SymptomChip } from './SymptomChip';
import { QuickReply } from './QuickReply';

interface CompanionMessageProps {
  response: PostMessageResponse;
  /** Called when user selects a "You could say…" prompt — pre-fills input */
  onQuickReply?: (text: string) => void;
  onRecordSymptom?: (symptom: PostMessageResponse['inferredSymptoms'][number]) => void;
  isLoading?: boolean;
  disabled?: boolean;
  /**
   * Whether this is the latest assistant message. Older messages render text
   * only, so symptom chips / techniques / prompts always reflect the most
   * recent user input rather than stale data from earlier turns.
   */
  isLatest?: boolean;
}

export function CompanionMessage({
  response,
  onQuickReply,
  onRecordSymptom,
  isLoading,
  disabled,
  isLatest = true,
}: CompanionMessageProps): React.ReactNode {
  // ── Loading bubble ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-start gap-2.5 max-w-3xl" data-testid="ai-response-loading" role="status" aria-label="Manas is thinking">
        <CompanionAvatar />
        <div className="bg-surface rounded-2xl rounded-tl-sm shadow-sm border border-text/10 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  const readiness = response.readiness ?? 'continue_exploring';
  const hasSafetyFlag = response.safetyFlag && response.safetyMessage;
  // Techniques and symptom chips are shown per turn — each turn's sections
  // describe that turn's user input. Quick-reply prompts and the readiness
  // banner are shown only on the latest response so there is one clear
  // "where we are" signal at the bottom of the conversation.
  const hasTechniques = response.techniques.length > 0;
  const hasSymptoms = response.inferredSymptoms.length > 0;
  const hasFollowUps = isLatest && (response.userInputPrompts ?? []).length > 0 && Boolean(onQuickReply);
  const hasContent = response.userFacingResponse.length > 0;

  return (
    <div className="flex items-start gap-2.5 max-w-3xl w-full" data-testid="ai-response">
      <CompanionAvatar />

      <div className="flex-1 min-w-0">
        {/* Safety alert — elevated above the main message */}
        {hasSafetyFlag && (
          <div className="mb-2 px-4 py-3 bg-error/8 border border-error/20 rounded-2xl rounded-tl-sm text-sm text-text leading-relaxed">
            <p className="font-semibold text-error mb-1">Important</p>
            {response.safetyMessage}
          </div>
        )}

        {/* Main companion bubble */}
        {hasContent && (
          <div className={`bg-surface rounded-2xl rounded-tl-sm shadow-sm border px-4 py-3 ${hasSafetyFlag ? 'border-error/20' : 'border-text/10'}`}>
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-2">
              {BRAND.guideName}
            </p>

            {/* Response text — plain, no markdown */}
            <div className="text-sm text-text leading-relaxed whitespace-pre-wrap">
              {response.userFacingResponse}
            </div>

            {/* Disclosure */}
            <p className="mt-3 text-[9px] text-text-muted/70 leading-snug">
              {BRAND.prototypeLabel}
            </p>
          </div>
        )}

        {/* Techniques — shown as separate cards beneath the bubble */}
        {hasTechniques && !hasSafetyFlag && (
          <div className="mt-3 space-y-2">
            <SectionLabel>Suggested techniques</SectionLabel>
            {response.techniques.map((technique) => (
              <TechniqueCard key={technique.id} technique={technique} />
            ))}
          </div>
        )}

        {/* Inferred symptoms — small chips to confirm */}
        {hasSymptoms && (
          <div className="mt-3">
            <SectionLabel>I noticed you mentioned</SectionLabel>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {response.inferredSymptoms.map((symptom, index) => (
                <SymptomChip
                  key={`${symptom.text}-${index}`}
                  symptom={symptom}
                  onRecord={onRecordSymptom}
                  disabled={disabled}
                />
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-text-muted">
              Tap &quot;Save&quot; to add a symptom to your profile. You can review or delete it in Privacy.
            </p>
          </div>
        )}

        {/* Readiness guidance — when to summarize or seek professional help */}
        {isLatest && readiness !== 'continue_exploring' && !hasSafetyFlag && (
          <div
            className={`mt-3 px-3 py-2 rounded-xl border text-xs leading-relaxed ${
              readiness === 'ready_to_summarize'
                ? 'bg-success/8 border-success/20 text-text'
                : 'bg-warning/8 border-warning/20 text-text'
            }`}
          >
            {readiness === 'ready_to_summarize'
              ? 'You’ve shared enough for a helpful summary. Tap "Summarize & next steps" below whenever you’re ready — no need to wait for me to ask — or keep talking if you’d like to explore more.'
              : 'A few more details will help me suggest the right next steps.'}
          </div>
        )}

        {/* Follow-up prompts — clarified as input helpers, not AI queries */}
        {hasFollowUps && (
          <div className="mt-3 bg-surface/50 border border-text/8 rounded-xl px-3 py-2.5">
            <QuickReply
              options={response.userInputPrompts ?? []}
              onSelect={onQuickReply!}
              disabled={disabled}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CompanionAvatar(): React.ReactNode {
  return (
    <div
      className="shrink-0 w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mt-0.5"
      aria-hidden="true"
    >
      <span className="text-[10px] font-bold text-primary">M</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
      {children}
    </p>
  );
}
