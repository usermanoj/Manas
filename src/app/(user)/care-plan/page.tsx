'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/Layout';
import { BRAND } from '@/lib/config/brand';

interface VersionData {
  id: string;
  carePlanId: string;
  versionNumber: number;
  goals: string[];
  assignedModules: string[];
  checkInFrequency: string;
  boundaries: Record<string, unknown>;
  followUpDate: string | null;
  status: string;
  clinicianApprovedAt: string | null;
  userAcceptedAt: string | null;
  createdAt: string;
  previousVersionId: string | null;
}

interface CarePlanData {
  id: string;
  userId: string;
  clinicianId: string;
  status: string;
  overallStatus: string;
  activeVersionId: string | null;
  latestVersionId: string;
  createdAt: string | null;
}

/**
 * Build a label like "Version 1 (ACTIVE)" or "Version 2 (CLINICIAN APPROVED)".
 */
function versionLabel(v: VersionData): string {
  return `Version ${v.versionNumber} (${v.status.replace(/_/g, ' ')})`;
}

/**
 * Return a Tailwind class for the version status badge.
 */
function statusBadgeClass(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800';
    case 'SUPERSEDED':
      return 'bg-gray-200 text-gray-600';
    case 'CLINICIAN_APPROVED':
      return 'bg-amber-100 text-amber-800';
    case 'DRAFT':
      return 'bg-blue-50 text-blue-700';
    case 'PROPOSED':
      return 'bg-indigo-100 text-indigo-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export default function CarePlanPage(): React.ReactNode {
  const [carePlan, setCarePlan] = useState<CarePlanData | null>(null);
  const [, setActiveVersion] = useState<VersionData | null>(null);
  const [latestVersion, setLatestVersion] = useState<VersionData | null>(null);
  const [versions, setVersions] = useState<VersionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchCurrentCarePlan = async (): Promise<void> => {
    try {
      const res = await fetch('/api/care-plans/current');
      if (!res.ok) throw new Error('Failed to fetch care plan');
      const data = await res.json();
      setCarePlan(data.carePlan);
      setActiveVersion(data.activeVersion);
      setLatestVersion(data.latestVersion);
      setVersions(data.versions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/care-plans/current');
        if (!res.ok) throw new Error('Failed to fetch care plan');
        const data = await res.json();
        if (!cancelled) {
          setCarePlan(data.carePlan);
          setActiveVersion(data.activeVersion);
          setLatestVersion(data.latestVersion);
          setVersions(data.versions ?? []);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleAccept = async (): Promise<void> => {
    if (!carePlan) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/care-plans/${carePlan.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? 'Failed to accept care plan');
      }
      setSuccessMessage('Care plan accepted and activated successfully.');
      await fetchCurrentCarePlan();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  // Find V1 and V2 for side-by-side comparison
  const v1 = versions.find((v) => v.versionNumber === 1);
  const v2 = versions.find((v) => v.versionNumber === 2);
  const hasV2 = v2 !== undefined;

  // V2 can be accepted by the user when it is CLINICIAN_APPROVED
  const v2PendingAcceptance = hasV2 && v2.status === 'CLINICIAN_APPROVED';

  return (
    <Layout>
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        <div className="flex items-center justify-between mb-6">
          <h1 className={`${BRAND.typography.headingSize} font-semibold text-text`}>
            My Care Plan
          </h1>
          <Link href="/privacy" className="text-sm text-primary hover:underline">
            Audit Timeline
          </Link>
        </div>

        {loading && <p className="text-text-muted">Loading care plan&hellip;</p>}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-4">
            Error: {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm mb-4">
            {successMessage}
          </div>
        )}

        {!loading && !carePlan && (
          <div className="bg-surface border border-text/10 rounded-lg p-8 text-center">
            <p className="text-text-muted">No care plan found yet.</p>
            <p className="text-sm text-text-muted mt-2">
              A care plan will appear here once your clinician creates one.
            </p>
          </div>
        )}

        {/* Current Care Plan Details — show latest version */}
        {carePlan && latestVersion && !hasV2 && (
          <section className="mb-8">
            <div className="bg-surface border border-text/10 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-text">
                  {versionLabel(latestVersion)}
                </h2>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusBadgeClass(latestVersion.status)}`}>
                  {latestVersion.status.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-text">Clinician:</span>
                  <span className="text-sm text-text-muted ml-2">{carePlan.clinicianId}</span>
                </div>

                <div>
                  <span className="text-sm font-medium text-text">Goals:</span>
                  <ul className="mt-1 space-y-1">
                    {latestVersion.goals.map((goal, idx) => (
                      <li key={idx} className="text-sm text-text-muted pl-4">
                        &bull; {goal}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <span className="text-sm font-medium text-text">Assigned Modules:</span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {latestVersion.assignedModules.map((mod) => (
                      <span key={mod} className="inline-flex items-center px-3 py-1 bg-primary/10 text-primary text-xs rounded-full">
                        {mod}
                        <span className="ml-2 text-[10px] italic text-text-muted">
                          ({BRAND.prototypeLabel})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-sm font-medium text-text">Check-in Frequency:</span>
                  <span className="text-sm text-text-muted ml-2">
                    {latestVersion.checkInFrequency.replace(/_/g, ' ')}
                  </span>
                </div>

                <div>
                  <span className="text-sm font-medium text-text">Boundaries:</span>
                  <ul className="mt-1 space-y-1">
                    {Object.entries(latestVersion.boundaries).map(([key, value]) => (
                      <li key={key} className="text-sm text-text-muted pl-4">
                        &bull; <span className="font-medium">{key}:</span> {String(value)}
                      </li>
                    ))}
                  </ul>
                </div>

                {latestVersion.followUpDate && (
                  <div>
                    <span className="text-sm font-medium text-text">Follow-up Date:</span>
                    <span className="text-sm text-text-muted ml-2">
                      {new Date(latestVersion.followUpDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Accept button for V1 when CLINICIAN_APPROVED (no V2 exists) */}
              {carePlan.overallStatus === 'CLINICIAN_APPROVED' && !hasV2 && (
                <div className="mt-6 pt-4 border-t border-text/10">
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={submitting}
                    className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? 'Accepting…' : 'Accept Plan'}
                  </button>
                  <p className="text-xs text-text-muted mt-2">
                    Accepting will activate the care plan. This action is recorded immutably.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* V1/V2 Side-by-Side Comparison */}
        {hasV2 && v1 && v2 && carePlan && (
          <section className="mb-8">
            <h2 className="text-lg font-medium text-text mb-3">Version Comparison</h2>
            <p className="text-sm text-text-muted mb-4">
              Your clinician has revised your care plan. Review the changes below.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* V1 */}
              <div className={`bg-surface border rounded-lg p-5 ${v1.status === 'SUPERSEDED' ? 'border-gray-300 opacity-75' : 'border-text/10'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-text">{versionLabel(v1)}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(v1.status)}`}>
                    {v1.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="space-y-2 text-xs text-text-muted">
                  <p><span className="font-medium text-text">Goals:</span></p>
                  <ul className="pl-3 space-y-0.5">
                    {v1.goals.map((g, i) => {
                      const removed = !v2.goals.includes(g);
                      return (
                        <li key={i} className={removed ? 'text-red-500 line-through' : ''}>
                          &bull; {g}{removed ? ' (removed)' : ''}
                        </li>
                      );
                    })}
                  </ul>
                  <p>
                    <span className="font-medium text-text">Frequency:</span>{' '}
                    <span className={v1.checkInFrequency !== v2.checkInFrequency ? 'text-orange-600 font-medium' : ''}>
                      {v1.checkInFrequency.replace(/_/g, ' ')}
                    </span>
                  </p>
                  <p><span className="font-medium text-text">Modules:</span> {v1.assignedModules.join(', ')}</p>
                  <p>
                    <span className="font-medium text-text">Boundaries:</span>
                  </p>
                  <ul className="pl-3 space-y-0.5">
                    {Object.entries(v1.boundaries).map(([key, value]) => (
                      <li key={key}>
                        &bull; <span className="font-medium text-text">{key}:</span> {String(value)}
                      </li>
                    ))}
                  </ul>
                  {v1.followUpDate && (
                    <p><span className="font-medium text-text">Follow-up:</span> {new Date(v1.followUpDate).toLocaleDateString()}</p>
                  )}
                </div>
              </div>

              {/* V2 */}
              <div className="bg-surface border-2 border-indigo-300 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-text">{versionLabel(v2)}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(v2.status)}`}>
                    {v2.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="space-y-2 text-xs text-text-muted">
                  <p><span className="font-medium text-text">Goals:</span></p>
                  <ul className="pl-3 space-y-0.5">
                    {v2.goals.map((g, i) => {
                      const isNew = !v1.goals.includes(g);
                      return (
                        <li key={i} className={isNew ? 'text-green-600 font-medium' : ''}>
                          &bull; {g}{isNew ? ' (new)' : ''}
                        </li>
                      );
                    })}
                  </ul>
                  <p>
                    <span className="font-medium text-text">Frequency:</span>{' '}
                    <span className={v1.checkInFrequency !== v2.checkInFrequency ? 'text-green-600 font-medium' : ''}>
                      {v2.checkInFrequency.replace(/_/g, ' ')}
                      {v1.checkInFrequency !== v2.checkInFrequency ? ' (changed)' : ''}
                    </span>
                  </p>
                  <p><span className="font-medium text-text">Modules:</span> {v2.assignedModules.join(', ')}</p>
                  <p>
                    <span className="font-medium text-text">Boundaries:</span>
                  </p>
                  <ul className="pl-3 space-y-0.5">
                    {Object.entries(v2.boundaries).map(([key, value]) => {
                      const v1Val = v1.boundaries[key];
                      const changed = v1Val === undefined || String(v1Val) !== String(value);
                      return (
                        <li key={key} className={changed ? 'text-green-600 font-medium' : ''}>
                          &bull; <span className="font-medium text-text">{key}:</span> {String(value)}
                          {changed && v1Val !== undefined ? ' (changed)' : changed ? ' (new)' : ''}
                        </li>
                      );
                    })}
                  </ul>
                  {v2.followUpDate && (
                    <p>
                      <span className="font-medium text-text">Follow-up:</span>{' '}
                      <span className={v1.followUpDate !== v2.followUpDate ? 'text-green-600 font-medium' : ''}>
                        {new Date(v2.followUpDate).toLocaleDateString()}
                        {v1.followUpDate !== v2.followUpDate ? ' (changed)' : ''}
                      </span>
                    </p>
                  )}
                </div>

                {/* Accept Revised Plan — when V2 is CLINICIAN_APPROVED */}
                {v2PendingAcceptance && (
                  <div className="mt-4 pt-4 border-t border-indigo-200">
                    <button
                      type="button"
                      onClick={handleAccept}
                      disabled={submitting}
                      className="w-full px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {submitting ? 'Accepting…' : 'Accept Revised Plan'}
                    </button>
                    <p className="text-xs text-text-muted mt-2 text-center">
                      Accepting will activate Version 2. Version 1 will be superseded.
                      This action is recorded immutably.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Version History */}
        {versions.length > 0 && carePlan && (
          <section>
            <h2 className="text-lg font-medium text-text mb-3">Immutable Version History</h2>
            <div className="space-y-3">
              {versions.map((v) => (
                <div key={v.id} className="bg-surface border border-text/10 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-text">{versionLabel(v)}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(v.status)}`}>
                      {v.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">
                    Created: {new Date(v.createdAt).toLocaleString()}
                  </p>
                  {v.clinicianApprovedAt && (
                    <p className="text-xs text-text-muted">
                      Clinician approved: {new Date(v.clinicianApprovedAt).toLocaleString()}
                    </p>
                  )}
                  {v.userAcceptedAt && (
                    <p className="text-xs text-text-muted">
                      User accepted: {new Date(v.userAcceptedAt).toLocaleString()}
                    </p>
                  )}
                  <p className="text-xs text-text-muted mt-1">
                    Goals: {v.goals.join(', ')}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    Modules: {v.assignedModules.map((m) => (
                      <span key={m} className="inline-flex items-center mr-2">
                        {m} <span className="ml-1 text-[10px] italic">({BRAND.prototypeLabel})</span>
                      </span>
                    ))}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
