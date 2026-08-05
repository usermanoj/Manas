'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';

type AccessMode = 'guest' | 'connected';

/**
 * Action bar for the marketing landing page.
 *
 * Signed-out visitors get the language/mode pills plus a gated CTA: Guest
 * Mode goes straight to the check-in, Connected Care routes through the login
 * page first so the mode is never silently downgraded.
 *
 * Signed-in users keep the card slim — a status chip, a short "My Space"
 * shortcut to their personal home (/home), and the check-in CTA.
 */
export function SetupBar(): React.ReactNode {
  const router = useRouter();
  const { user, logout } = useAuth();
  // null = no explicit choice yet; signed-out visitors default to Guest Mode.
  const [chosenMode, setChosenMode] = useState<AccessMode | null>(null);
  const mode: AccessMode = chosenMode ?? 'guest';

  const signedOutConnected = mode === 'connected' && !user;
  const firstName = user?.displayName?.split(' ')[0] ?? '';

  // Signed in — slim card: status, My Space shortcut, check-in CTA.
  if (user) {
    return (
      <>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" aria-hidden="true" />
            <span className="text-xs font-semibold text-primary">Signed in as {firstName} · Connected Care</span>
          </span>
          <button
            type="button"
            onClick={() => void logout()}
            className="text-[11px] font-medium text-text-muted hover:text-text underline-offset-2 hover:underline transition-colors"
          >
            Sign out
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* Short shortcut into the personal home */}
          <Link
            href="/home"
            data-testid="open-my-space"
            className="group inline-flex items-center gap-2 rounded-2xl border border-primary/40 bg-surface px-7 py-3 text-sm font-semibold text-primary transition-all duration-300 hover:bg-primary hover:text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            My Space
            <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>

          {/* CTA */}
          <button
            type="button"
            onClick={() => router.push('/check-in')}
            className="group inline-flex items-center gap-2 bg-gradient-to-r from-primary to-primary-light hover:from-primary-light hover:to-primary text-white font-semibold px-10 py-3 rounded-2xl text-sm shadow-lg shadow-primary/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none"
          >
            Begin Check-In
            <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </>
    );
  }

  const beginCheckIn = (): void => {
    if (mode === 'connected' && !user) {
      router.push('/login?next=/check-in');
      return;
    }
    router.push('/check-in');
  };

  const pillClass = (selected: boolean): string =>
    `inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
      selected
        ? 'border-primary bg-primary/8 text-primary shadow-sm'
        : 'border-text/15 bg-background/60 text-text group-hover:border-primary/40'
    }`;

  return (
    <>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        {/* Language pills */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-text">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Language
          </span>
          <label className="cursor-pointer group">
            <input type="radio" name="language" value="en" defaultChecked className="sr-only" />
            <span className="inline-flex items-center rounded-full border border-text/15 bg-background/60 px-3.5 py-1.5 text-xs font-medium text-text transition-all duration-200 group-hover:border-primary/40 has-checked:border-primary has-checked:bg-primary/8 has-checked:text-primary has-checked:shadow-sm">
              English
            </span>
          </label>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-text/10 bg-background/40 px-3.5 py-1.5 text-xs font-medium text-text-muted opacity-70 cursor-not-allowed">
            More languages
            <span className="text-[9px] font-semibold uppercase tracking-wide bg-warning/15 text-warning px-1.5 py-0.5 rounded-full">
              Soon
            </span>
          </span>
        </div>

        <span className="hidden sm:block w-px h-6 bg-text/10" aria-hidden="true" />

        {/* Mode — segmented pills */}
        <div className="flex items-center gap-2" role="radiogroup" aria-label="Access mode">
          <label className="cursor-pointer group">
            <input
              type="radio"
              name="mode"
              value="guest"
              checked={mode === 'guest'}
              onChange={() => setChosenMode('guest')}
              className="sr-only"
            />
            <span className={pillClass(mode === 'guest')}>
              <span className={`w-2 h-2 rounded-full border transition-colors ${mode === 'guest' ? 'border-primary bg-primary' : 'border-text/30'}`} aria-hidden="true" />
              Guest Mode
              <span className="text-[9px] font-semibold uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Quickest</span>
            </span>
          </label>
          <label className="cursor-pointer group">
            <input
              type="radio"
              name="mode"
              value="connected"
              checked={mode === 'connected'}
              onChange={() => setChosenMode('connected')}
              className="sr-only"
            />
            <span className={pillClass(mode === 'connected')}>
              <span className={`w-2 h-2 rounded-full border transition-colors ${mode === 'connected' ? 'border-primary bg-primary' : 'border-text/30'}`} aria-hidden="true" />
              Connected Care
            </span>
          </label>
        </div>
      </div>

      {/* CTA — centred */}
      <button
        type="button"
        onClick={beginCheckIn}
        className="group inline-flex items-center gap-2 bg-gradient-to-r from-primary to-primary-light hover:from-primary-light hover:to-primary text-white font-semibold px-10 py-3 rounded-2xl text-sm shadow-lg shadow-primary/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none"
      >
        Begin Check-In
        <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </button>

      {/* Sign-in hint — only when Connected Care needs an account */}
      <p
        className={`text-xs text-text-muted transition-opacity duration-200 ${signedOutConnected ? 'opacity-100' : 'h-0 overflow-hidden opacity-0'}`}
        aria-hidden={!signedOutConnected}
      >
        Connected Care keeps your history and unlocks care plans — sign in first, then continue.
      </p>
    </>
  );
}
