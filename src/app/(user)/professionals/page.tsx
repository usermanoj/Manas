'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { BRAND } from '@/lib/config/brand';
import { ProviderCard } from '@/components/providers/ProviderCard';
import type { ProviderSummary } from '@/components/providers/ProviderCard';
import { ProviderDetail } from '@/components/providers/ProviderDetail';
import { ProviderFilters } from '@/components/providers/ProviderFilters';

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function Spinner(): React.ReactNode {
  return (
    <div className="flex justify-center items-center py-12">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }): React.ReactNode {
  return (
    <div className="bg-error/10 border border-error/30 rounded-lg p-6 text-center">
      <p className="text-error font-medium mb-3">{message}</p>
      <button
        onClick={onRetry}
        className="bg-primary text-white hover:bg-primary-light rounded-lg px-4 py-2 text-sm font-medium transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function ProfessionalsPage(): React.ReactNode {
  const router = useRouter();

  // Data state
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([]);

  // Detail overlay state
  const [detailProvider, setDetailProvider] = useState<ProviderSummary | null>(null);

  // Fetch providers
  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/providers');
      if (!res.ok) throw new Error('Failed to load providers.');
      const data = await res.json() as { providers: ProviderSummary[] };
      setProviders(data.providers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data loading on mount requires setState in effect
    fetchProviders();
  }, [fetchProviders]);

  // Client-side filtering
  const filteredProviders = useMemo(() => {
    return providers.filter((p) => {
      // Language filter
      if (selectedLanguage && !p.languages.includes(selectedLanguage)) return false;
      // Focus area filter (provider must have ALL selected focus areas)
      if (selectedFocusAreas.length > 0) {
        const hasAll = selectedFocusAreas.every((area) => p.focusAreas.includes(area));
        if (!hasAll) return false;
      }
      return true;
    });
  }, [providers, selectedLanguage, selectedFocusAreas]);

  // Focus area change handler
  const handleFocusAreaChange = useCallback((area: string, checked: boolean) => {
    setSelectedFocusAreas((prev) =>
      checked ? [...prev, area] : prev.filter((a) => a !== area),
    );
  }, []);

  // Select provider: store in sessionStorage and navigate to /handoff
  const handleSelect = useCallback((provider: ProviderSummary) => {
    try {
      sessionStorage.setItem('manas-selected-provider', JSON.stringify(provider));
    } catch {
      // Ignore storage errors.
    }
    setDetailProvider(null);
    router.push('/handoff');
  }, [router]);

  return (
    <Layout>
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        {/* Header */}
        <h1 className={`${BRAND.typography.headingSize} font-semibold text-text mb-2`}>
          Find a Professional
        </h1>
        <p className="text-text-muted mb-8">
          These are fictional demo profiles created for demonstration purposes only. They do not represent real practitioners.
        </p>

        {/* Loading */}
        {loading && <Spinner />}

        {/* Error */}
        {!loading && error && <ErrorMessage message={error} onRetry={fetchProviders} />}

        {/* Content */}
        {!loading && !error && (
          <div className="space-y-6">
            {/* Filters */}
            <ProviderFilters
              providers={providers}
              selectedLanguage={selectedLanguage}
              selectedFocusAreas={selectedFocusAreas}
              onLanguageChange={setSelectedLanguage}
              onFocusAreaChange={handleFocusAreaChange}
            />

            {/* Results count */}
            <p className="text-sm text-text-muted">
              Showing {filteredProviders.length} of {providers.length} profiles
            </p>

            {/* Card grid */}
            {filteredProviders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProviders.map((provider) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    onSelect={handleSelect}
                    onViewDetails={setDetailProvider}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-text-muted">No profiles match your current filters.</p>
                <button
                  onClick={() => { setSelectedLanguage(''); setSelectedFocusAreas([]); }}
                  className="mt-2 text-primary hover:underline text-sm font-medium"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Detail overlay */}
        {detailProvider && (
          <ProviderDetail
            provider={detailProvider}
            onSelect={handleSelect}
            onClose={() => setDetailProvider(null)}
          />
        )}
      </div>
    </Layout>
  );
}
