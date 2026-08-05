'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/Layout';
import { BRAND } from '@/lib/config/brand';
import { useAuth } from '@/components/auth/AuthProvider';

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
  /** Structured scheduling fields for timezone conversion (provider-local time). */
  timezone?: string;
  availabilityDays?: string;
  availabilityStartHour?: number;
  availabilityStartMinute?: number;
  availabilityEndHour?: number;
  availabilityEndMinute?: number;
  nextAvailableDay?: string;
  nextAvailableHour?: number;
  nextAvailableMinute?: number;
  credentialsNote: string;
  bio: string;
  isFictionalDemo: boolean;
  /** Marks a genuine provider — displayed prominently as "Actual Profile". */
  isActualProfile?: boolean;
}

const PRICE_RANGES = [
  { label: 'Any price', min: 0, max: Infinity },
  { label: 'Under $100', min: 0, max: 99 },
  { label: '$100 – $130', min: 100, max: 130 },
  { label: '$130+', min: 130, max: Infinity },
];

interface TimezoneOption {
  code: string;
  timeZone: string;
}

const TIMEZONES: TimezoneOption[] = [
  { code: 'SGT', timeZone: 'Asia/Singapore' },
  { code: 'IST', timeZone: 'Asia/Kolkata' },
  { code: 'EST', timeZone: 'America/New_York' },
  { code: 'BST', timeZone: 'Europe/London' },
  { code: 'PST', timeZone: 'America/Los_Angeles' },
  { code: 'CET', timeZone: 'Europe/Paris' },
  { code: 'JST', timeZone: 'Asia/Tokyo' },
  { code: 'AEST', timeZone: 'Australia/Sydney' },
];

const DEFAULT_TZ_CODE = 'SGT';

/** Fixed reference instant — wall-clock conversion is demo-only and date-independent. */
const REFERENCE_UTC_MS = Date.UTC(2026, 0, 15, 0, 0, 0);

const offsetCache = new Map<string, number>();

function tzOffsetMinutes(timeZone: string, atUtcMs: number = REFERENCE_UTC_MS): number {
  const cacheKey = `${timeZone}@${atUtcMs}`;
  const cached = offsetCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const ref = new Date(atUtcMs);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(ref)) parts[part.type] = part.value;
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offset = Math.round((asUTC - ref.getTime()) / 60000);
  offsetCache.set(cacheKey, offset);
  return offset;
}

/** Converts a wall-clock time from one IANA zone to another, tracking day rollover. */
function convertWallTime(
  hour: number,
  minute: number,
  fromTimeZone: string,
  toTimeZone: string,
): { minutes: number; dayShift: number } {
  const total = hour * 60 + minute + (tzOffsetMinutes(toTimeZone) - tzOffsetMinutes(fromTimeZone));
  return { minutes: ((total % 1440) + 1440) % 1440, dayShift: Math.floor(total / 1440) };
}

function formatClock(minutes: number): string {
  let h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return m === 0 ? `${h} ${suffix}` : `${h}:${String(m).padStart(2, '0')} ${suffix}`;
}

function utcOffsetLabel(timeZone: string): string {
  // Use today's offset so the label reflects current DST (e.g. EST shows GMT−4 in summer).
  const offset = tzOffsetMinutes(timeZone, Date.now());
  const sign = offset >= 0 ? '+' : '−';
  const abs = Math.abs(offset);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `GMT${sign}${h}${m > 0 ? `:${String(m).padStart(2, '0')}` : ''}`;
}

function availabilityInTz(p: Provider, tz: TimezoneOption): string {
  if (!p.timezone || !p.availabilityDays || p.availabilityStartHour === undefined || p.availabilityEndHour === undefined) {
    return p.availability;
  }
  const start = convertWallTime(p.availabilityStartHour, p.availabilityStartMinute ?? 0, p.timezone, tz.timeZone);
  const end = convertWallTime(p.availabilityEndHour, p.availabilityEndMinute ?? 0, p.timezone, tz.timeZone);
  const note = end.dayShift > start.dayShift ? ' (+1 day)' : end.dayShift < start.dayShift ? ' (−1 day)' : '';
  return `${p.availabilityDays} · ${formatClock(start.minutes)}–${formatClock(end.minutes)}${note} ${tz.code}`;
}

function nextAvailableInTz(p: Provider, tz: TimezoneOption): string {
  if (!p.timezone || !p.nextAvailableDay || p.nextAvailableHour === undefined) return p.nextAvailable;
  const t = convertWallTime(p.nextAvailableHour, p.nextAvailableMinute ?? 0, p.timezone, tz.timeZone);
  const note =
    t.dayShift === 1 ? ' (next day)' : t.dayShift === -1 ? ' (prev day)' : '';
  return `${p.nextAvailableDay} · ${formatClock(t.minutes)}${note} ${tz.code}`;
}

const AVATAR_GRADIENTS = [
  'from-primary to-primary-light',
  'from-primary-light to-secondary',
  'from-secondary to-accent',
  'from-primary to-secondary',
];

function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => w.length > 0 && !w.endsWith('.'));
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function MetaItem({ label, value }: { label: string; value: string }): React.ReactNode {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <div className="mt-0.5 w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
        <p className="text-[13px] text-text font-medium whitespace-nowrap" title={value}>{value}</p>
      </div>
    </div>
  );
}

function ProviderCard({ p, index, tz }: { p: Provider; index: number; tz: TimezoneOption }): React.ReactNode {
  return (
    <div
      data-testid={`provider-card-${p.id}`}
      className={`group bg-surface rounded-2xl border shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 overflow-hidden ${
        p.isActualProfile
          ? 'border-primary/30 ring-1 ring-primary/20 hover:border-primary/50'
          : 'border-text/10 hover:border-primary/30'
      }`}
    >
      {/* Accent strip */}
      <div className={`h-1 bg-gradient-to-r ${AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]}`} />

      <div className="p-6 md:p-7">
        {/* Header: avatar, identity, price */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-5">
          <div
            className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]} flex items-center justify-center text-white text-lg font-semibold shadow-md shrink-0`}
            aria-hidden="true"
          >
            {initials(p.name)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-text leading-tight">{p.name}</h2>
              {p.isActualProfile ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide text-white bg-gradient-to-r from-primary to-primary-light shadow-md shadow-primary/25">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Actual Profile
                </span>
              ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/70">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                Demo profile
              </span>
              )}
            </div>
            <p className="text-sm font-medium text-primary mt-0.5">{p.title}</p>
            <p className="text-xs text-text-muted mt-1">{p.credentialsNote}</p>
          </div>

          <div className="sm:text-right shrink-0">
            <p className="text-2xl font-bold text-text leading-none">
              ${p.pricePerSession}
            </p>
            <p className="text-xs text-text-muted mt-1">
              per {p.sessionDurationMinutes}-min session
            </p>
          </div>
        </div>

        {/* Focus areas */}
        <div className="flex flex-wrap gap-2 mb-5">
          {p.focusAreas.map((area) => (
            <span
              key={area}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/8 text-primary border border-primary/15"
            >
              {area}
            </span>
          ))}
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-5">
          <MetaItem label="Session type" value={p.sessionType} />
          <MetaItem label="Availability" value={availabilityInTz(p, tz)} />
          <MetaItem label="Next available" value={nextAvailableInTz(p, tz)} />
          <MetaItem label="Languages" value={p.languages.join(', ')} />
        </div>

        {/* Bio */}
        <p className="text-sm text-text-muted leading-relaxed mb-6">{p.bio}</p>

        {/* Action bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-text/10 pt-5">
          <p className="text-xs text-text-muted">
            Free to browse — you&apos;ll only sign in when you request an intro.
          </p>
          <Link
            data-testid={`handoff-link-${p.id}`}
            href={`/handoff?providerId=${p.id}`}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-light shadow-sm hover:shadow-md transition-all"
          >
            Request Intro
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ProfessionalsPage(): React.ReactNode {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [priceFilter, setPriceFilter] = useState(0);
  const [focusFilter, setFocusFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [tzCode, setTzCode] = useState(DEFAULT_TZ_CODE);

  const selectedTz = TIMEZONES.find((t) => t.code === tzCode) ?? TIMEZONES[0];
  const tzOptions = useMemo(
    () => TIMEZONES.map((t) => ({ ...t, label: `${t.code} · ${utcOffsetLabel(t.timeZone)}` })),
    [],
  );

  const { user, loading: authLoading } = useAuth();
  const isGuest = !authLoading && !user;

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
    return () => {
      cancelled = true;
    };
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

  const hasActiveFilters = priceFilter !== 0 || focusFilter !== '' || languageFilter !== '';

  return (
    <Layout>
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary-light text-white p-8 md:p-10 mb-8 shadow-lg">
          <div
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-2xl"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-secondary/25 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70 mb-3">
              Manas Network
            </p>
            <h1 className={`${BRAND.typography.headingSize} font-bold text-white mb-3`}>
              Browse Professionals
            </h1>
            <p className="text-white/85 text-sm md:text-base max-w-xl leading-relaxed mb-6">
              Explore our curated directory at your own pace. Compare focus areas, pricing, and
              availability — and request an introduction only when you feel ready.
            </p>

            {/* Trust signals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z', text: 'Browse freely — no account' },
                { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', text: 'You control what is shared' },
                { icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Actual profiles and demo profiles' },
              ].map((item) => (
                <div
                  key={item.text}
                  className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm rounded-xl px-3.5 py-2.5"
                >
                  <svg className="w-5 h-5 text-white/90 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  <span className="text-xs font-medium text-white/90 leading-snug">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Prototype disclaimer */}
        <div className="bg-warning/5 border border-warning/25 rounded-xl px-4 py-2.5 mb-8">
          <p className="text-xs text-text-muted text-center">{BRAND.prototypeLabel}</p>
        </div>

        {/* Filter bar */}
        <div className="bg-surface border border-text/10 rounded-2xl shadow-sm p-4 md:p-5 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="timezone-filter" className="block text-xs font-semibold text-text-muted mb-1.5">
                Your timezone
              </label>
              <select
                id="timezone-filter"
                value={tzCode}
                onChange={(e) => setTzCode(e.target.value)}
                className="w-full border border-text/15 rounded-xl px-3 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
              >
                {tzOptions.map((t) => (
                  <option key={t.code} value={t.code}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="price-filter" className="block text-xs font-semibold text-text-muted mb-1.5">
                Price range
              </label>
              <select
                id="price-filter"
                value={priceFilter}
                onChange={(e) => setPriceFilter(Number(e.target.value))}
                className="w-full border border-text/15 rounded-xl px-3 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
              >
                {PRICE_RANGES.map((r, i) => (
                  <option key={r.label} value={i}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="focus-filter" className="block text-xs font-semibold text-text-muted mb-1.5">
                Focus area
              </label>
              <select
                id="focus-filter"
                value={focusFilter}
                onChange={(e) => setFocusFilter(e.target.value)}
                className="w-full border border-text/15 rounded-xl px-3 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
              >
                <option value="">All focus areas</option>
                {allFocusAreas.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="language-filter" className="block text-xs font-semibold text-text-muted mb-1.5">
                Language
              </label>
              <select
                id="language-filter"
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                className="w-full border border-text/15 rounded-xl px-3 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
              >
                <option value="">All languages</option>
                {allLanguages.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-text/10">
            <p className="text-xs text-text-muted">
              {loading
                ? 'Loading directory…'
                : `${filteredProviders.length} ${filteredProviders.length === 1 ? 'professional' : 'professionals'} available · times shown in ${selectedTz.code}`}
            </p>
            {hasActiveFilters && (
              <button
                onClick={() => { setPriceFilter(0); setFocusFilter(''); setLanguageFilter(''); }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Guest hint */}
        {isGuest && !loading && !error && (
          <div className="flex items-start gap-3 bg-primary/5 border border-primary/15 rounded-xl px-4 py-3 mb-8">
            <svg className="w-5 h-5 text-primary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-text-muted leading-relaxed">
              You&apos;re browsing as a guest — that&apos;s completely fine. You&apos;ll only be asked to sign in
              when you choose a professional and request an introduction.
            </p>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex justify-center items-center py-16">
            <div className="w-9 h-9 border-4 border-primary/25 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="bg-error/5 border border-error/25 rounded-2xl p-8 text-center">
            <p className="text-error font-medium mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-primary text-white hover:bg-primary-light rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filteredProviders.length === 0 && (
          <div className="text-center py-16 bg-surface border border-text/10 rounded-2xl">
            <div className="w-14 h-14 bg-primary/8 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-text font-semibold text-lg mb-1">No matches found</p>
            <p className="text-text-muted text-sm mb-5">Try broadening your filters to see more professionals.</p>
            <button
              onClick={() => { setPriceFilter(0); setFocusFilter(''); setLanguageFilter(''); }}
              className="inline-flex items-center px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-light transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Provider cards */}
        {!loading && !error && filteredProviders.length > 0 && (
          <div className="space-y-6">
            {filteredProviders.map((p, index) => (
              <ProviderCard key={p.id} p={p} index={index} tz={selectedTz} />
            ))}
          </div>
        )}

        {/* Footer reassurance */}
        {!loading && !error && filteredProviders.length > 0 && (
          <div className="mt-10 text-center">
            <p className="text-xs text-text-muted leading-relaxed max-w-lg mx-auto">
              Every profile above is a fictional demonstration. Requesting an intro creates a
              consent-controlled handoff — nothing is shared without your explicit approval.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
