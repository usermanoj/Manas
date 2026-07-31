import { useMemo } from 'react';
import type { ProviderSummary } from './ProviderCard';

interface ProviderFiltersProps {
  providers: ProviderSummary[];
  selectedLanguage: string;
  selectedFocusAreas: string[];
  onLanguageChange: (language: string) => void;
  onFocusAreaChange: (focusArea: string, checked: boolean) => void;
}

export function ProviderFilters({
  providers,
  selectedLanguage,
  selectedFocusAreas,
  onLanguageChange,
  onFocusAreaChange,
}: ProviderFiltersProps): React.ReactNode {
  // Extract unique languages and focus areas from all providers.
  const uniqueLanguages = useMemo(() => {
    const set = new Set<string>();
    for (const p of providers) {
      for (const lang of p.languages) set.add(lang);
    }
    return Array.from(set).sort();
  }, [providers]);

  const uniqueFocusAreas = useMemo(() => {
    const set = new Set<string>();
    for (const p of providers) {
      for (const area of p.focusAreas) set.add(area);
    }
    return Array.from(set).sort();
  }, [providers]);

  return (
    <div className="bg-surface rounded-xl shadow-sm border border-text/10 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-text">Filters</h3>

      {/* Language dropdown */}
      <div>
        <label htmlFor="language-filter" className="block text-xs font-medium text-text-muted mb-1">
          Language
        </label>
        <select
          id="language-filter"
          value={selectedLanguage}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="w-full border border-text/20 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary/40 outline-none bg-background"
        >
          <option value="">All languages</option>
          {uniqueLanguages.map((lang) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
      </div>

      {/* Focus area checkboxes */}
      <div>
        <span className="block text-xs font-medium text-text-muted mb-2">Focus areas</span>
        <div className="flex flex-wrap gap-2">
          {uniqueFocusAreas.map((area) => {
            const checked = selectedFocusAreas.includes(area);
            return (
              <label
                key={area}
                className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1 cursor-pointer transition-colors border ${
                  checked
                    ? 'bg-primary/10 text-primary border-primary/40'
                    : 'bg-background text-text-muted border-text/20 hover:border-text/40'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onFocusAreaChange(area, e.target.checked)}
                  className="sr-only"
                />
                {area}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
