'use client';

/**
 * Shared presentation for techniques Manas suggested during a check-in.
 *
 * Used on the user-facing summary page and on the handoff page so the
 * professional sees the exact same practices, steps, and linked sources
 * that were shown to the user.
 */

import { useState } from 'react';
import type { TechniqueSuggestion } from '@/domain/ai';

interface CitationEntry {
  source: string;
  title?: string;
  url?: string;
  year?: string;
  description?: string;
}

interface TechniqueCardProps {
  technique: TechniqueSuggestion;
  defaultOpen?: boolean;
}

/** Expandable technique card — click the name to reveal steps, mechanism, and
 * sources, mirroring the in-chat technique experience. */
export function TechniqueCard({ technique, defaultOpen = false }: TechniqueCardProps): React.ReactNode {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-text/10 rounded-xl overflow-hidden bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-primary/5 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="text-sm font-medium text-text">{technique.name}</span>
        </span>
        <svg
          className={`w-4 h-4 text-text-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {technique.whenToUse && (
            <p className="text-sm text-text-muted italic">{technique.whenToUse}</p>
          )}
          {technique.steps.length > 0 && (
            <ol className="space-y-1.5">
              {technique.steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm text-text">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          )}
          {technique.mechanism && (
            <p className="text-xs text-text-muted">{technique.mechanism}</p>
          )}
          {technique.duration && (
            <p className="text-xs text-text-muted">Duration: {technique.duration}</p>
          )}
          {technique.citations.length > 0 && (
            <div className="pt-2 border-t border-text/10 space-y-1">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Sources</p>
              {technique.citations.map((c, idx) => (
                <p key={idx} className="text-xs text-text-muted">
                  {c.title ?? c.source}
                  {c.year ? ` — ${c.source} (${c.year})` : ` — ${c.source}`}
                  {c.url && (
                    <>
                      {' · '}
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        view source
                      </a>
                    </>
                  )}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Collapsible "Sources" list — collapsed by default, tap to expand. */
export function CollapsibleSources({ citations }: { citations: CitationEntry[] }): React.ReactNode {
  const [open, setOpen] = useState(false);
  if (citations.length === 0) return null;
  return (
    <div className="pt-4 border-t border-text/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 text-left py-1 group"
      >
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wide group-hover:text-text transition-colors">
          Sources ({citations.length})
        </span>
        <svg
          className={`w-4 h-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <ul className="space-y-3 mt-3">
          {citations.map((citation, idx) => (
            <li key={idx} className="text-sm">
              <p className="font-medium text-text">{citation.title ?? citation.source}</p>
              {citation.description && <p className="text-text-muted">{citation.description}</p>}
              {citation.url ? (
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-xs"
                >
                  {citation.source}{citation.year ? ` (${citation.year})` : ''}
                </a>
              ) : (
                <p className="text-text-muted text-xs">{citation.source}{citation.year ? ` (${citation.year})` : ''}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
