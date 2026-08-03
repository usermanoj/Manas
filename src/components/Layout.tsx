'use client';

import Link from 'next/link';
import { BRAND } from '@/lib/config/brand';
import { DisclosureBanner } from '@/components/DisclosureBanner';
import { useAuth } from '@/components/auth/AuthProvider';
import { ManusCompanion } from '@/components/chatbot/ManusCompanion';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps): React.ReactNode {
  const { user, loading, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-surface border-b border-text/10">
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 py-4 flex items-center justify-between`}>
          <Link href="/" className="text-xl font-semibold text-primary">
            {BRAND.name}
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm">
            <Link href="/check-in" className="text-text-muted hover:text-primary transition-colors">
              Check-In
            </Link>
            <Link href="/summary" className="text-text-muted hover:text-primary transition-colors">
              Summary
            </Link>
            <Link href="/care-plan" className="text-text-muted hover:text-primary transition-colors">
              Care Plan
            </Link>
            <Link href="/handoff" className="text-text-muted hover:text-primary transition-colors">
              Handoff
            </Link>
            <Link href="/professionals" className="text-text-muted hover:text-primary transition-colors">
              Professionals
            </Link>
            <Link href="/privacy" className="text-text-muted hover:text-primary transition-colors">
              Privacy
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            {!loading && user?.role === 'clinician' && (
              <Link
                href="/clinician"
                className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium"
              >
                Clinician
              </Link>
            )}
            {!loading && user && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-muted hidden sm:inline">
                  Hi, {user.displayName.split(' ')[0]}
                </span>
                <button
                  onClick={logout}
                  className="text-xs px-3 py-1.5 border border-text/20 text-text rounded-lg hover:bg-surface transition-colors"
                >
                  Sign out
                </button>
              </div>
            )}
            {!loading && !user && (
              <Link
                href="/login"
                className="text-xs px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-light transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <DisclosureBanner />
      <main className="flex-1">{children}</main>
      <ManusCompanion />
      <footer className="bg-surface border-t border-text/10 mt-auto">
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 py-4 text-center`}>
          <p className="text-sm text-text-muted">
            Not an emergency service. If you are in crisis, please contact local emergency services.
          </p>
        </div>
      </footer>
    </div>
  );
}
