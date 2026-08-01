'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/Layout';
import { BRAND } from '@/lib/config/brand';

interface HandoffSummary {
  id: string;
  userId: string;
  providerId: string;
  status: string;
  sentAt: string | null;
  version: number;
  structuredSummary: {
    primary_concern: string;
    concern_duration: string;
    sleep_impact: string;
    daily_functioning_impact: string;
    support_preference: string;
    feels_safe: string;
    key_points: string[];
  };
  consent: {
    id: string;
    status: string;
    grantedAt: string;
    expiresAt: string;
  } | null;
}

function StatusBadge({ status }: { status: string }): React.ReactNode {
  const colorMap: Record<string, string> = {
    SENT: 'bg-blue-100 text-blue-800',
    CLINICIAN_ACCEPTED: 'bg-green-100 text-green-800',
    COMPLETED: 'bg-gray-100 text-gray-800',
  };
  const colors = colorMap[status] ?? 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function ClinicianDashboardPage(): React.ReactNode {
  const [handoffs, setHandoffs] = useState<HandoffSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHandoffs() {
      try {
        const res = await fetch('/api/clinician/handoffs');
        if (!res.ok) {
          throw new Error('Failed to fetch handoffs');
        }
        const data = await res.json();
        setHandoffs(data.handoffs ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchHandoffs();
  }, []);

  return (
    <Layout>
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        <div className="flex items-center justify-between mb-8">
          <h1 className={`${BRAND.typography.headingSize} font-semibold text-text`}>
            Clinician Inbox
          </h1>
        </div>

        {loading && (
          <p className="text-text-muted">Loading handoffs&hellip;</p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            Error: {error}
          </div>
        )}

        {!loading && !error && handoffs.length === 0 && (
          <div className="bg-surface border border-text/10 rounded-lg p-8 text-center">
            <p className="text-text-muted">No handoffs in your inbox yet.</p>
            <p className="text-sm text-text-muted mt-2">
              Handoffs will appear here once users complete a check-in and send their summary.
            </p>
          </div>
        )}

        {!loading && handoffs.length > 0 && (
          <div className="space-y-4">
            {handoffs.map((handoff) => (
              <div
                key={handoff.id}
                className="bg-surface border border-text/10 rounded-lg p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-lg font-medium text-text">
                        User: {handoff.userId}
                      </h2>
                      <StatusBadge status={handoff.status} />
                    </div>
                    <p className="text-text-muted text-sm mb-1">
                      <span className="font-medium">Primary concern:</span>{' '}
                      {handoff.structuredSummary.primary_concern.length > 80
                        ? `${handoff.structuredSummary.primary_concern.slice(0, 80)}…`
                        : handoff.structuredSummary.primary_concern}
                    </p>
                    <p className="text-text-muted text-xs">
                      Received: {handoff.sentAt ? new Date(handoff.sentAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <Link
                    href={`/clinician/care-plan?handoffId=${handoff.id}`}
                    className="ml-4 inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Create Care Plan
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
