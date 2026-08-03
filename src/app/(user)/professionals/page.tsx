'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/Layout';
import { BRAND } from '@/lib/config/brand';
import { ContactGate, useContactGate } from '@/components/providers/ContactGate';

interface Provider {
  id: string;
  profileId: string;
  name: string;
  title: string;
  languages: string[];
  focusAreas: string[];
  availability: string;
  sessionType: string;
  priceRange: string;
  pricePerSession: number;
  currency: string;
  sessionDurationMinutes: number;
  nextAvailable: string;
  credentialsNote: string;
  bio: string;
  isFictionalDemo: boolean;
}

const PRICE_RANGES = [
  { label: 'Any price', min: 0, max: Infinity },
  { label: 'Under $100', min: 0, max: 99 },
  { label: '$100 – $130', min: 100, max: 130 },
  { label: '$130+', min: 130, max: Infinity },
];

function ProviderCard({
  p,
  isSelected,
  onToggle,
  gated,
}: {
  p: Provider;
  isSelected: boolean;
  onToggle: () => void;
  gated: boolean;
}): React.ReactNode {
  return (
    <div
      data-testid={`provider-card-${p.id}`}
      className={`bg-surface rounded-xl shadow-sm border transition-colors ${
        isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-text/10 hover:border-primary/40'
      }`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-text">{p.name}</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">
                Fictional Provider
              </span>
            </div>
            <p className="text-sm text-primary font-medium">{p.title}</p>
            <p className="text-xs text-text-muted mt-1">{p.credentialsNote}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-lg font-semibold text-text">
              ${p.pricePerSession} <span className="text-xs font-normal text-text-muted">{p.currency}</span>
            </p>
            <p className="text-xs text-text-muted">{p.sessionDurationMinutes} min session</p>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm mb-4">
          <div>
            <span className="font-medium text-text">Languages</span>
            <p className="text-text-muted">{p.languages.join(', ')}</p>
          </div>
          <div>
            <span className="font-medium text-text">Session type</span>
            <p className="text-text-muted">{p.sessionType}</p>
          </div>
          <div>
            <span className="font-medium text-text">Availability</span>
            <p className="text-text-muted">{p.availability}</p>
          </div>
          <div>
            <span className="font-medium text-text">Next available</span>
            <p className="text-text-muted">{p.nextAvailable}</p>
          </div>
        </div>

        {/* Focus areas */}
        <div className="mb-4">
          <span className="text-sm font-medium text-text">Focus areas</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {p.focusAreas.map((area) => (
              <span
                key={area}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
              >
                {area}
              </span>
            ))}
          </div>
        </div>

        {/* Bio */}
        <p className="text-sm text-text-muted leading-relaxed mb-4">{p.bio}</p>

        {/* Action area */}
        <div className="border-t border-text/10 pt-4 mt-2">
          {gated ? (
            <ContactGate
              title="Save your contact details"
              description="Sign in or create a free account so a professional can respond to your request in this demonstration workspace."
            >
              <Link
                data-testid={`handoff-link-${p.id}`}
                href={`/handoff?providerId=${p.id}`}
                className="inline-flex items-center px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                Request Intro &rarr;
              </Link>
            </ContactGate>
          ) : (
            <button
              onClick={onToggle}
              className="inline-flex items-center px-5 py-2 text-primary font-medium rounded-lg hover:bg-primary/5 transition-colors"
            >
              {isSelected ? 'Hide details' : 'View details & request intro'}
            </button>
          )}
          {!gated && isSelected && (
            <div className="mt-3">
              <Link
                data-testid={`handoff-link-${p.id}`}
                href={`/handoff?providerId=${p.id}`}
                className="inline-flex items-center px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                Request Intro &rarr;
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProfessionalsPage(): React.ReactNode {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters
  const [priceFilter, setPriceFilter] = useState(0);
  const [focusFilter, setFocusFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');

  const { gated, loading: gateLoading } = useContactGate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/providers');
        if (!res.ok) throw new Error('Failed to load providers.');
        const data = await res.json();
        if (!cancelled) setProviders(data.providers ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'An unexpected error occurred.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const allFocusAreas = useMemo(
    () => Array.from(new Set(providers.flatMap((p) => p.focusAreas))).sort(),
    [providers],
  );
  const allLanguages = useMemo(
    () => Array.from(new Set(providers.flatMap((p) => p.languages))).sort(),
    [providers],
  );

  const filteredProviders = useMemo(() => {
    const range = PRICE_RANGES[priceFilter];
    return providers.filter((p) => {
      const matchesPrice = p.pricePerSession >= range.min && p.pricePerSession <= range.max;
      const matchesFocus = !focusFilter || p.focusAreas.includes(focusFilter);
      const matchesLanguage = !languageFilter || p.languages.includes(languageFilter);
      return matchesPrice && matchesFocus && matchesLanguage;
    });
  }, [providers, priceFilter, focusFilter, languageFilter]);

  return (
    <Layout>
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        {/* Prototype disclaimer */}
        <div className="bg-warning/5 border border-warning/30 rounded-lg p-3 mb-6">
          <p className="text-sm text-text-muted text-center">
            {BRAND.prototypeLabel}
          </p>
        </div>

        <div className="mb-8">
          <h1 className={`${BRAND.typography.headingSize} font-semibold text-text mb-2`}>
            Professionals Directory
          </h1>
          <p className="text-text-muted">
            Browse fictional demo providers. Prices are for demonstration only — no real payments are processed.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-surface border border-text/10 rounded-xl p-4 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="price-filter" className="block text-xs font-medium text-text-muted mb-1">
                Price range
              </label>
              <select
                id="price-filter"
                value={priceFilter}
                onChange={(e) => setPriceFilter(Number(e.target.value))}
                className="w-full border border-text/20 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary outline-none"
              >
                {PRICE_RANGES.map((r, i) => (
                  <option key={r.label} value={i}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="focus-filter" className="block text-xs font-medium text-text-muted mb-1">
                Focus area
              </label>
              <select
                id="focus-filter"
                value={focusFilter}
                onChange={(e) => setFocusFilter(e.target.value)}
                className="w-full border border-text/20 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="">All focus areas</option>
                {allFocusAreas.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="language-filter" className="block text-xs font-medium text-text-muted mb-1">
                Language
              </label>
              <select
                id="language-filter"
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                className="w-full border border-text/20 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="">All languages</option>
                {allLanguages.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {(loading || gateLoading) && (
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {/* Error state */}
        {!loading && !gateLoading && error && (
          <div className="bg-error/10 border border-error/30 rounded-lg p-6 text-center">
            <p className="text-error font-medium mb-3">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-primary text-white hover:bg-primary-light rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !gateLoading && !error && filteredProviders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-text-muted text-lg">No providers match your filters.</p>
            <button
              onClick={() => { setPriceFilter(0); setFocusFilter(''); setLanguageFilter(''); }}
              className="mt-4 inline-block text-primary hover:underline font-medium"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Provider cards */}
        {!loading && !gateLoading && !error && filteredProviders.length > 0 && (
          <div className="space-y-6">
            {filteredProviders.map((p) => (
              <ProviderCard
                key={p.id}
                p={p}
                isSelected={selectedId === p.id}
                onToggle={() => setSelectedId(selectedId === p.id ? null : p.id)}
                gated={gated}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
