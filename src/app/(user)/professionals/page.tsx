'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/Layout';
import { BRAND } from '@/lib/config/brand';

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
  bio: string;
  isFictionalDemo: boolean;
}

export default function ProfessionalsPage(): React.ReactNode {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  return (
    <Layout>
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        {/* Prototype disclaimer */}
        <div className="bg-warning/5 border border-warning/30 rounded-lg p-3 mb-6">
          <p className="text-sm text-text-muted text-center">
            {BRAND.prototypeLabel}
          </p>
        </div>

        <h1 className={`${BRAND.typography.headingSize} font-semibold text-text mb-2`}>
          Professionals Directory
        </h1>
        <p className="text-text-muted mb-8">
          Browse fictional demo providers. Selecting one will take you to the handoff workspace.
        </p>

        {/* Loading state */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
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
        {!loading && !error && providers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-text-muted text-lg">No providers available at this time.</p>
            <Link href="/" className="mt-4 inline-block text-primary hover:underline font-medium">
              &larr; Back to Home
            </Link>
          </div>
        )}

        {/* Provider cards */}
        {!loading && !error && providers.length > 0 && (
          <div className="space-y-6">
            {providers.map((p) => (
              <div
                key={p.id}
                data-testid={`provider-card-${p.id}`}
                className={`bg-surface rounded-xl shadow-sm border transition-colors cursor-pointer ${
                  selectedId === p.id ? 'border-primary ring-2 ring-primary/20' : 'border-text/10 hover:border-primary/40'
                }`}
                onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(selectedId === p.id ? null : p.id); } }}
                role="button"
                tabIndex={0}
                aria-pressed={selectedId === p.id}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-text">{p.name}</h2>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">
                          Fictional Provider
                        </span>
                      </div>
                      <p className="text-sm text-primary font-medium">{p.title}</p>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
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
                      <span className="font-medium text-text">Price range</span>
                      <p className="text-text-muted">{p.priceRange}</p>
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

                  {/* Select / Proceed action */}
                  {selectedId === p.id && (
                    <div className="border-t border-text/10 pt-4 mt-2">
                      <Link
                        data-testid={`handoff-link-${p.id}`}
                        href={`/handoff?providerId=${p.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        Proceed to Handoff &rarr;
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
