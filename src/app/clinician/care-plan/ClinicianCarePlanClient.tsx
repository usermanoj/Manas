'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BRAND } from '@/lib/config/brand';

interface HandoffData {
  id: string;
  userId: string;
  providerId: string;
  status: string;
  sentAt: string | null;
  structuredSummary: {
    primary_concern: string;
    key_points: string[];
  };
}

interface CarePlanData {
  id: string;
  status: string;
  overallStatus: string;
  activeVersionId: string | null;
  latestVersionId: string;
}

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
  createdAt: string;
  previousVersionId: string | null;
}

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'twice_per_week', label: 'Twice per week' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
];

/**
 * Build a label like "Version 1 (ACTIVE)" or "Version 2 (SUPERSEDED)".
 */
function versionLabel(v: VersionData, carePlan: CarePlanData): string {
  const tag =
    v.id === carePlan.activeVersionId
      ? 'ACTIVE'
      : v.status === 'SUPERSEDED'
        ? 'SUPERSEDED'
        : v.status;
  return `Version ${v.versionNumber} (${tag.replace(/_/g, ' ')})`;
}

export default function ClinicianCarePlanClient(): React.ReactNode {
  const searchParams = useSearchParams();
  const handoffId = searchParams.get('handoffId');

  const [handoff, setHandoff] = useState<HandoffData | null>(null);
  const [carePlan, setCarePlan] = useState<CarePlanData | null>(null);
  const [versions, setVersions] = useState<VersionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Create form state (initial care plan from handoff)
  const [goals, setGoals] = useState([
    { id: 'goal-1', title: 'Build emotional awareness', description: 'Develop the ability to notice, name, and understand emotional patterns in daily life.' },
    { id: 'goal-2', title: 'Develop coping strategies', description: 'Learn and practice healthy coping mechanisms for stress and challenging emotions.' },
  ]);
  const [checkInFrequency, setCheckInFrequency] = useState('twice_per_week');
  const [boundaries, setBoundaries] = useState('Support focuses on everyday work-related stress and wellbeing; it does not replace medical care\nShare crisis resources promptly if any safety concern is raised\nWeekly clinician review of progress; plan adjusted only with your approval');
  const [followUpDate, setFollowUpDate] = useState('');

  // Revision form state
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revGoals, setRevGoals] = useState<{ id: string; title: string; description: string }[]>([]);
  const [revFrequency, setRevFrequency] = useState('');
  const [revBoundaries, setRevBoundaries] = useState('');
  const [revFollowUpDate, setRevFollowUpDate] = useState('');

  // Fetch handoff data on mount
  useEffect(() => {
    async function fetchInitial(): Promise<void> {
      try {
        // Fetch handoff if handoffId provided
        if (handoffId) {
          const res = await fetch('/api/clinician/handoffs');
          if (res.ok) {
            const data = await res.json();
            const found = (data.handoffs ?? []).find((h: HandoffData) => h.id === handoffId);
            if (found) setHandoff(found);
          }
        }

        // Fetch the current care plan. Scoping by handoffId lets the API
        // resolve the handoff's owner so the workspace also works for real
        // (non-demo) users, not just the demo account.
        const currentUrl = handoffId
          ? `/api/care-plans/current?handoffId=${encodeURIComponent(handoffId)}`
          : '/api/care-plans/current';
        const cpRes = await fetch(currentUrl);
        if (cpRes.ok) {
          const cpData = await cpRes.json();
          if (cpData.carePlan) {
            setCarePlan({
              id: cpData.carePlan.id,
              status: cpData.carePlan.status,
              overallStatus: cpData.carePlan.overallStatus,
              activeVersionId: cpData.carePlan.activeVersionId,
              latestVersionId: cpData.carePlan.latestVersionId,
            });
            setVersions(cpData.versions ?? []);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchInitial();
  }, [handoffId]);

  const fetchVersions = useCallback(async (cpId: string) => {
    try {
      const res = await fetch(`/api/care-plans/${cpId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions ?? []);
      }
    } catch {
      // Silently ignore version fetch errors
    }
  }, []);

  const refreshCarePlan = useCallback(async () => {
    try {
      const currentUrl = handoffId
        ? `/api/care-plans/current?handoffId=${encodeURIComponent(handoffId)}`
        : '/api/care-plans/current';
      const res = await fetch(currentUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.carePlan) {
          setCarePlan({
            id: data.carePlan.id,
            status: data.carePlan.status,
            overallStatus: data.carePlan.overallStatus,
            activeVersionId: data.carePlan.activeVersionId,
            latestVersionId: data.carePlan.latestVersionId,
          });
          setVersions(data.versions ?? []);
        }
      }
    } catch {
      // Ignore
    }
  }, [handoffId]);

  const handleCreateCarePlan = async (): Promise<void> => {
    if (!handoffId) return;
    setSubmitting(true);
    setError(null);
    try {
      const boundaryList = boundaries.split('\n').filter((b) => b.trim().length > 0);
      const res = await fetch('/api/care-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handoffId,
          goals,
          assignedModuleIds: ['module-pause-reflect'],
          checkInFrequency,
          boundaries: boundaryList,
          followUpDate: followUpDate || undefined,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? 'Failed to create care plan');
      }
      const data = await res.json();
      setCarePlan({
        id: data.carePlan.id,
        status: data.carePlan.status,
        overallStatus: data.carePlan.overallStatus,
        activeVersionId: data.carePlan.activeVersionId,
        latestVersionId: data.carePlan.latestVersionId,
      });
      setSuccessMessage('Care plan created successfully in DRAFT status.');
      await fetchVersions(data.carePlan.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransition = async (action: string): Promise<void> => {
    if (!carePlan) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/care-plans/${carePlan.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? `Failed to ${action} care plan`);
      }
      setSuccessMessage(`Action "${action}" completed successfully.`);
      await refreshCarePlan();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  // Open revision form pre-filled from the active version
  const openRevisionForm = (): void => {
    const activeV = versions.find((v) => v.id === carePlan?.activeVersionId);
    if (!activeV) return;
    setRevGoals(activeV.goals.map((g, i) => ({ id: `rev-goal-${i}`, title: g, description: '' })));
    setRevFrequency(activeV.checkInFrequency);
    const boundaryItems = activeV.boundaries?.items;
    const boundaryStr = Array.isArray(boundaryItems)
      ? (boundaryItems as string[]).join('\n')
      : Object.values(activeV.boundaries ?? {}).map(String).join('\n');
    setRevBoundaries(boundaryStr);
    setRevFollowUpDate(activeV.followUpDate ? activeV.followUpDate.slice(0, 10) : '');
    setShowRevisionForm(true);
    setSuccessMessage(null);
    setError(null);
  };

  const handleRevise = async (): Promise<void> => {
    if (!carePlan) return;
    setSubmitting(true);
    setError(null);
    try {
      const boundaryList = revBoundaries.split('\n').filter((b) => b.trim().length > 0);
      const res = await fetch(`/api/care-plans/${carePlan.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revise',
          changes: {
            goals: revGoals,
            checkInFrequency: revFrequency,
            boundaries: boundaryList,
            followUpDate: revFollowUpDate || undefined,
          },
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? 'Failed to revise care plan');
      }
      setShowRevisionForm(false);
      setSuccessMessage('Revision created — V2 is now in DRAFT. Propose it when ready.');
      await refreshCarePlan();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  // V1/V2 helpers
  const v1 = versions.find((v) => v.versionNumber === 1);
  const v2 = versions.find((v) => v.versionNumber === 2);
  const hasV2 = v2 !== undefined;

  // Determine whether the current care plan is an existing ACTIVE one (loaded from /current)
  const isActiveExisting = carePlan?.overallStatus === 'ACTIVE';

  if (!handoffId && !carePlan) {
    return (
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        <h1 className={`${BRAND.typography.headingSize} font-semibold text-text`}>Care Plan Workspace</h1>
        <p className="mt-2 text-text-muted">No handoff specified and no existing care plan found. Please access this page from the clinician inbox.</p>
        <Link href="/clinician" className="mt-4 inline-block text-primary hover:underline">&larr; Back to Inbox</Link>
      </div>
    );
  }

  return (
    <>
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        <div className="flex items-center justify-between mb-6">
          <h1 className={`${BRAND.typography.headingSize} font-semibold text-text`}>
            Care Plan Workspace
          </h1>
          <Link href="/clinician" className="text-sm text-primary hover:underline">
            &larr; Back to Inbox
          </Link>
        </div>

        {loading && <p className="text-text-muted">Loading handoff data&hellip;</p>}

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

        {/* Handoff Summary (read-only) */}
        {handoff && (
          <section className="mb-8">
            <h2 className="text-lg font-medium text-text mb-3">Handoff Summary (read-only)</h2>
            <div className="bg-surface border border-text/10 rounded-lg p-5">
              <p className="text-sm text-text-muted mb-1">
                <span className="font-medium">User:</span> {handoff.userId}
              </p>
              <p className="text-sm text-text-muted mb-1">
                <span className="font-medium">Primary concern:</span> {handoff.structuredSummary.primary_concern}
              </p>
              <p className="text-sm text-text-muted mb-1">
                <span className="font-medium">Status:</span> {handoff.status}
              </p>
              <p className="text-sm text-text-muted">
                <span className="font-medium">Key points:</span> {handoff.structuredSummary.key_points.join(', ')}
              </p>
            </div>
          </section>
        )}

        {/* Create Care Plan Form — only when no care plan exists yet */}
        {!carePlan && handoff && (
          <section className="mb-8">
            <h2 className="text-lg font-medium text-text mb-3">Create Care Plan</h2>
            <div className="bg-surface border border-text/10 rounded-lg p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-1">Goals</label>
                {goals.map((g, idx) => (
                  <div key={g.id} className="mb-2">
                    <input
                      type="text"
                      value={g.title}
                      onChange={(e) => {
                        const updated = [...goals];
                        updated[idx] = { ...g, title: e.target.value };
                        setGoals(updated);
                      }}
                      className="w-full px-3 py-2 border border-text/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="Goal title"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">Assigned Modules</label>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                    Pause and Reflect
                  </span>
                  <span className="text-xs text-text-muted">{BRAND.prototypeLabel}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">Check-in Frequency</label>
                <select
                  value={checkInFrequency}
                  onChange={(e) => setCheckInFrequency(e.target.value)}
                  className="w-full px-3 py-2 border border-text/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">Boundaries (one per line)</label>
                <textarea
                  value={boundaries}
                  onChange={(e) => setBoundaries(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-text/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Enter boundaries, one per line"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">Follow-up Date</label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 border border-text/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateCarePlan}
                disabled={submitting}
                className="w-full px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Creating…' : 'Create Care Plan'}
              </button>
            </div>
          </section>
        )}

        {/* Care Plan Actions — shown when a care plan exists */}
        {carePlan && (
          <section className="mb-8">
            <h2 className="text-lg font-medium text-text mb-3">Care Plan Actions</h2>
            <div className="bg-surface border border-text/10 rounded-lg p-5">
              <p className="text-sm text-text-muted mb-3">
                <span className="font-medium">Care Plan ID:</span> {carePlan.id}
              </p>
              <p className="text-sm text-text-muted mb-4">
                <span className="font-medium">Status:</span>{' '}
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {carePlan.overallStatus.replace(/_/g, ' ')}
                </span>
              </p>

              <div className="flex flex-wrap gap-3">
                {carePlan.overallStatus === 'DRAFT' && (
                  <button
                    type="button"
                    onClick={() => handleTransition('propose')}
                    disabled={submitting}
                    className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? 'Proposing…' : 'Propose'}
                  </button>
                )}
                {carePlan.overallStatus === 'PROPOSED' && (
                  <button
                    type="button"
                    onClick={() => handleTransition('approve')}
                    disabled={submitting}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? 'Approving…' : 'Approve'}
                  </button>
                )}

                {/* Revise Plan — only when ACTIVE and no V2 yet, or V2 is not ACTIVE */}
                {isActiveExisting && !showRevisionForm && (
                  <button
                    type="button"
                    onClick={openRevisionForm}
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    Revise Plan
                  </button>
                )}

                {/* V2 in DRAFT → propose it */}
                {hasV2 && v2.status === 'DRAFT' && carePlan.overallStatus !== 'DRAFT' && (
                  <button
                    type="button"
                    onClick={() => handleTransition('propose')}
                    disabled={submitting}
                    className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? 'Proposing V2…' : 'Propose V2'}
                  </button>
                )}
                {/* V2 in PROPOSED → approve it */}
                {hasV2 && v2.status === 'PROPOSED' && (
                  <button
                    type="button"
                    onClick={() => handleTransition('approve')}
                    disabled={submitting}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? 'Approving V2…' : 'Approve V2'}
                  </button>
                )}

                {carePlan.overallStatus === 'ACTIVE' && !hasV2 && (
                  <button
                    type="button"
                    onClick={() => handleTransition('pause')}
                    disabled={submitting}
                    className="px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? 'Pausing…' : 'Pause'}
                  </button>
                )}
                {!['RETIRED', 'COMPLETED'].includes(carePlan.overallStatus) && (
                  <button
                    type="button"
                    onClick={() => handleTransition('retire')}
                    disabled={submitting}
                    className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? 'Retiring…' : 'Retire'}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Revision Form */}
        {showRevisionForm && carePlan && (
          <section className="mb-8">
            <h2 className="text-lg font-medium text-text mb-3">Revise Active Plan</h2>
            <div className="bg-surface border border-indigo-200 rounded-lg p-5 space-y-4">
              <p className="text-xs text-text-muted">
                Creating a new version (V{(v1?.versionNumber ?? 1) + 1}). The active version stays live until V2 is fully approved and accepted.
              </p>

              <div>
                <label className="block text-sm font-medium text-text mb-1">Goals</label>
                {revGoals.map((g, idx) => (
                  <div key={g.id} className="mb-2 flex gap-2">
                    <input
                      type="text"
                      value={g.title}
                      onChange={(e) => {
                        const updated = [...revGoals];
                        updated[idx] = { ...g, title: e.target.value };
                        setRevGoals(updated);
                      }}
                      className="flex-1 px-3 py-2 border border-text/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="Goal title"
                    />
                    <button
                      type="button"
                      onClick={() => setRevGoals(revGoals.filter((_, i) => i !== idx))}
                      className="px-2 py-1 text-red-500 border border-red-200 rounded-lg text-xs hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setRevGoals([...revGoals, { id: `rev-goal-${Date.now()}`, title: '', description: '' }])}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  + Add goal
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">Check-in Frequency</label>
                <select
                  value={revFrequency}
                  onChange={(e) => setRevFrequency(e.target.value)}
                  className="w-full px-3 py-2 border border-text/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">Boundaries (one per line)</label>
                <textarea
                  value={revBoundaries}
                  onChange={(e) => setRevBoundaries(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-text/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">Follow-up Date</label>
                <input
                  type="date"
                  value={revFollowUpDate}
                  onChange={(e) => setRevFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 border border-text/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleRevise}
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Creating revision…' : 'Create Revision'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRevisionForm(false)}
                  className="px-4 py-2 border border-text/20 text-text text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </section>
        )}

        {/* V1/V2 Side-by-Side Comparison */}
        {hasV2 && v1 && v2 && carePlan && (
          <section className="mb-8">
            <h2 className="text-lg font-medium text-text mb-3">Version Comparison</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* V1 */}
              <div className={`bg-surface border rounded-lg p-5 ${v1.status === 'SUPERSEDED' ? 'border-gray-300 opacity-75' : 'border-text/10'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-text">{versionLabel(v1, carePlan)}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v1.status === 'SUPERSEDED' ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-800'}`}>
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
                          &bull; {g}{removed ? ' (removed in V2)' : ''}
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
                  {v1.followUpDate && (
                    <p><span className="font-medium text-text">Follow-up:</span> {new Date(v1.followUpDate).toLocaleDateString()}</p>
                  )}
                </div>
              </div>

              {/* V2 */}
              <div className="bg-surface border-2 border-indigo-300 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-text">{versionLabel(v2, carePlan)}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-medium">
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
              </div>
            </div>
          </section>
        )}

        {/* Version History */}
        {versions.length > 0 && carePlan && (
          <section>
            <h2 className="text-lg font-medium text-text mb-3">Version History</h2>
            <div className="space-y-3">
              {versions.map((v) => (
                <div key={v.id} className="bg-surface border border-text/10 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-text">{versionLabel(v, carePlan)}</h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {v.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">
                    Created: {new Date(v.createdAt).toLocaleString()}
                  </p>
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
    </>
  );
}
