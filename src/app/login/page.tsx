'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { BRAND } from '@/lib/config/brand';
import { useAuth } from '@/components/auth/AuthProvider';

export default function LoginPage(): React.ReactNode {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Login failed.');
      }
      await refresh();
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className={`${BRAND.typography.headingSize} font-semibold text-text mb-2`}>
              Welcome back
            </h1>
            <p className="text-text-muted">Sign in to continue your wellbeing journey.</p>
          </div>

          <div className="bg-surface border border-text/10 rounded-xl shadow-sm p-6 md:p-8">
            {error && (
              <div className="mb-4 bg-error/10 border border-error/30 rounded-lg p-3 text-error text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-text/20 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-text mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-text/20 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary text-white hover:bg-primary-light rounded-lg px-6 py-3 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-text/10 text-center text-sm text-text-muted">
              <p>
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-primary hover:underline font-medium">
                  Create one
                </Link>
              </p>
              <p className="mt-3">
                <Link href="/professional/login" className="text-primary hover:underline font-medium">
                  Sign in as a clinician
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-text-muted">
            <p>Demo account: ananya@example.com / password123</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
