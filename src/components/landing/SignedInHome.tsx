'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BRAND } from '@/lib/config/brand';
import { useAuth } from '@/components/auth/AuthProvider';
import { WORKSPACE_TILES, timeOfDayGreeting } from '@/components/landing/workspace-tiles';

/**
 * Full-screen personal space for signed-in users (/home) — a calm, breathable
 * sanctuary: a personal greeting, one primary action, and spacious workspace
 * tiles. Reached from the landing page's "My Space" shortcut; signed-out
 * visitors are sent back to the landing page.
 */
export function SignedInHome(): React.ReactNode {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  // Personal space requires an account session.
  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="w-3 h-3 rounded-full bg-primary/40 animate-pulse" aria-hidden="true" />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  if (!user) return null;

  const firstName = user.displayName?.split(' ')[0] ?? 'there';

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Ambient background wash */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -right-32 w-[32rem] h-[32rem] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-[28rem] h-[28rem] rounded-full bg-secondary/15 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[24rem] h-[24rem] rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* AI Disclosure strip */}
      <div className="relative bg-surface/70 backdrop-blur-sm border-b border-text/10">
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 py-2`}>
          <p className="text-[11px] text-text-muted text-center leading-relaxed">{BRAND.disclosure}</p>
        </div>
      </div>

      {/* Sanctuary — everything breathes around a single centred column */}
      <main className="relative flex-1 flex items-center justify-center px-4 md:px-8 py-12 md:py-16">
        <div className="w-full max-w-3xl" data-testid="workspace-hub">
          {/* Quiet status row */}
          <div className="flex items-center justify-center gap-3 mb-8 md:mb-10 animate-fade-up">
            <Link
              href="/"
              className="text-xs font-medium text-text-muted hover:text-text underline-offset-2 hover:underline transition-colors"
            >
              ← Home
            </Link>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" aria-hidden="true" />
              <span className="text-xs font-semibold text-primary">Connected Care</span>
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              className="text-xs font-medium text-text-muted hover:text-text underline-offset-2 hover:underline transition-colors"
            >
              Sign out
            </button>
          </div>

          {/* Greeting */}
          <h1
            className="text-4xl md:text-5xl font-bold tracking-tight text-text text-center mb-4 animate-fade-up"
            style={{ animationDelay: '0.08s' }}
          >
            {timeOfDayGreeting()}, {firstName}
          </h1>
          <p
            className="text-base md:text-lg text-text-muted text-center leading-relaxed max-w-md mx-auto mb-10 md:mb-12 animate-fade-up"
            style={{ animationDelay: '0.16s' }}
          >
            Ready when you are — start a fresh check-in, or pick up exactly where you left off.
          </p>

          {/* One primary action */}
          <div className="flex justify-center mb-14 md:mb-16 animate-fade-up" style={{ animationDelay: '0.24s' }}>
            <button
              type="button"
              onClick={() => router.push('/check-in')}
              className="group inline-flex items-center gap-3 bg-gradient-to-r from-primary to-primary-light hover:from-primary-light hover:to-primary text-white font-semibold px-14 py-4 rounded-2xl text-lg shadow-lg shadow-primary/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none"
            >
              Begin Check-In
              <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-8 animate-fade-up" style={{ animationDelay: '0.3s' }} aria-hidden="true">
            <span className="flex-1 h-px bg-text/10" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted whitespace-nowrap">
              Or continue where you left off
            </span>
            <span className="flex-1 h-px bg-text/10" />
          </div>

          {/* Workspace tiles — roomy, left-aligned cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 md:gap-4">
            {WORKSPACE_TILES.map((tile, i) => (
              <Link
                key={tile.href}
                href={tile.href}
                className="group flex items-center gap-4 rounded-2xl border border-text/10 bg-surface/60 backdrop-blur-sm px-5 py-4 transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10 animate-fade-up"
                style={{ animationDelay: `${0.35 + i * 0.06}s` }}
              >
                <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/12 to-secondary/12 border border-primary/15 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d={tile.icon} />
                  </svg>
                </span>
                <span className="min-w-0 text-left">
                  <span className="block text-sm font-semibold text-text">{tile.label}</span>
                  <span className="block text-xs text-text-muted mt-0.5">{tile.desc}</span>
                </span>
                <svg className="w-4 h-4 text-text-muted/50 ml-auto shrink-0 transition-all duration-200 group-hover:text-primary group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative bg-surface/70 backdrop-blur-sm border-t border-text/10">
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 py-2.5 text-center`}>
          <p className="text-[11px] text-text-muted font-medium">
            Not an emergency service. If you are in crisis, please contact local emergency services.
          </p>
        </div>
      </footer>
    </div>
  );
}
