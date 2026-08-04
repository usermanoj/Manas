'use client';

import { useState } from 'react';
import type { TechniqueSuggestion } from '@/domain/ai';

interface TechniqueCardProps {
  technique: TechniqueSuggestion;
}

export function TechniqueCard({ technique }: TechniqueCardProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-surface rounded-xl border border-primary/20 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-text">{technique.name}</h4>
          <p className="text-xs text-text-muted mt-0.5">{technique.whenToUse}</p>
        </div>
        <span className="shrink-0 text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          {technique.duration}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="mt-2 text-xs font-medium text-primary hover:text-primary-light focus:outline-none"
        aria-expanded={expanded}
      >
        {expanded ? 'Hide steps' : 'Show steps'}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <ol className="space-y-2">
            {technique.steps.map((step, index) => (
              <li key={index} className="flex gap-3 text-sm text-text">
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <p className="text-xs text-text-muted bg-secondary/10 rounded-lg p-2.5">
            <span className="font-medium text-text">Why it works:</span> {technique.mechanism}
          </p>

          {technique.citations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Sources</p>
              {technique.citations.map((citation, index) => (
                <div key={index} className="text-sm">
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
                  {citation.year && (
                    <span className="text-text-muted"> ({citation.year})</span>
                  )}
                  {citation.description && (
                    <p className="text-xs text-text-muted mt-0.5">{citation.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
