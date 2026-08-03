'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';

interface ContactGateProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

/**
 * ContactGate
 *
 * Wraps content that should only be visible to signed-in users.
 * Anonymous users see a gentle prompt to sign in or register so their
 * contact details can be saved before reaching a professional.
 */
export function ContactGate({
  children,
  title = 'Save your contact details',
  description = 'To connect with a professional, please sign in or create a free account. This helps professionals respond to you in the demonstration workspace.',
}: ContactGateProps): React.ReactNode {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-surface border border-text/10 rounded-xl p-6 md:p-8 text-center max-w-lg mx-auto">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-text mb-2">{title}</h2>
        <p className="text-text-muted text-sm mb-6">{description}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-light transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center px-5 py-2.5 border border-text/20 text-text font-medium rounded-lg hover:bg-surface transition-colors"
          >
            Create Account
          </Link>
        </div>
        <p className="mt-4 text-xs text-text-muted">
          This is a demonstration — no real contact requests are sent.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * useContactGate
 *
 * Returns whether the user has passed the contact gate. Useful when the
 * gating UI needs to be inline rather than wrapping children.
 */
export function useContactGate(): { gated: boolean; loading: boolean } {
  const { user, loading } = useAuth();
  return { gated: !loading && !user, loading };
}
