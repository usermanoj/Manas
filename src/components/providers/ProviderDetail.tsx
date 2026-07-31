import { useEffect, useRef } from 'react';
import type { ProviderSummary } from './ProviderCard';

interface ProviderDetailProps {
  provider: ProviderSummary;
  onSelect: (provider: ProviderSummary) => void;
  onClose: () => void;
}

export function ProviderDetail({ provider, onSelect, onClose }: ProviderDetailProps): React.ReactNode {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus close button on mount for keyboard accessibility.
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Close on Escape key.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Details for ${provider.name}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Fictional banner */}
        <div className="bg-secondary/20 px-6 py-2 text-xs font-medium text-secondary text-center">
          Fictional Demo Profile — not a real practitioner.
        </div>

        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-text">{provider.name}</h2>
              <p className="text-sm text-text-muted">{provider.title}</p>
            </div>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close detail view"
              className="text-text-muted hover:text-text text-xl leading-none p-1 rounded focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              ✕
            </button>
          </div>

          {/* Bio */}
          <div>
            <h3 className="text-sm font-semibold text-text mb-1">About</h3>
            <p className="text-sm text-text-muted leading-relaxed">{provider.bio}</p>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="font-semibold text-text">Languages</span>
              <p className="text-text-muted">{provider.languages.join(', ')}</p>
            </div>
            <div>
              <span className="font-semibold text-text">Session type</span>
              <p className="text-text-muted">{provider.sessionType}</p>
            </div>
            <div>
              <span className="font-semibold text-text">Availability</span>
              <p className="text-text-muted">{provider.availability}</p>
            </div>
            <div>
              <span className="font-semibold text-text">Price range</span>
              <p className="text-text-muted">{provider.priceRange}</p>
            </div>
          </div>

          {/* Focus areas */}
          <div>
            <h3 className="text-sm font-semibold text-text mb-2">Focus areas</h3>
            <div className="flex flex-wrap gap-1.5">
              {provider.focusAreas.map((area) => (
                <span
                  key={area}
                  className="inline-block bg-primary/10 text-primary text-xs font-medium rounded-full px-2.5 py-0.5"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>

          {/* Select action */}
          <button
            onClick={() => onSelect(provider)}
            className="w-full bg-primary text-white hover:bg-primary-light rounded-lg px-6 py-3 text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            Select this provider
          </button>
        </div>
      </div>
    </div>
  );
}
