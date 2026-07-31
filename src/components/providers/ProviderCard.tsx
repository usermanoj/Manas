import { BRAND } from '@/lib/config/brand';

export interface ProviderSummary {
  id: string;
  name: string;
  title: string;
  languages: string[];
  focusAreas: string[];
  availability: string;
  sessionType: string;
  priceRange: string;
  bio: string;
  isFictionalDemo: true;
}

interface ProviderCardProps {
  provider: ProviderSummary;
  onSelect: (provider: ProviderSummary) => void;
  onViewDetails: (provider: ProviderSummary) => void;
}

export function ProviderCard({ provider, onSelect, onViewDetails }: ProviderCardProps): React.ReactNode {
  return (
    <div className="bg-surface rounded-xl shadow-sm border border-text/10 overflow-hidden flex flex-col">
      {/* Fictional banner */}
      <div className="bg-secondary/20 px-4 py-2 text-xs font-medium text-secondary text-center">
        Fictional Demo Profile — not a real practitioner.
      </div>

      <div className={`${BRAND.spacing.cardPadding} flex flex-col gap-3 flex-1`}>
        {/* Name & title */}
        <div>
          <h3 className="text-lg font-semibold text-text">{provider.name}</h3>
          <p className="text-sm text-text-muted">{provider.title}</p>
        </div>

        {/* Languages */}
        <div className="text-sm text-text-muted">
          <span className="font-medium text-text">Languages:</span>{' '}
          {provider.languages.join(', ')}
        </div>

        {/* Focus areas as tags */}
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

        {/* Availability & price */}
        <div className="text-sm text-text-muted space-y-0.5 mt-auto">
          <p>
            <span className="font-medium text-text">Availability:</span>{' '}
            {provider.availability}
          </p>
          <p>
            <span className="font-medium text-text">Price:</span>{' '}
            {provider.priceRange}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => onViewDetails(provider)}
            className="flex-1 border border-primary text-primary hover:bg-primary/10 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            View details
          </button>
          <button
            onClick={() => onSelect(provider)}
            className="flex-1 bg-primary text-white hover:bg-primary-light rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            Select this provider
          </button>
        </div>
      </div>
    </div>
  );
}
