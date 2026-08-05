'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/Layout';
import { BRAND } from '@/lib/config/brand';
import {
  CLINICIAN_NOTE,
  GENERIC_GOAL_GUIDANCE,
  WEEKLY_RHYTHM,
  RESOURCES,
  CARE_BOUNDARIES_HEADING,
  guidanceForGoal,
} from '@/lib/config/care-plan-guidance';

/** Display names for assigned wellbeing modules. */
const MODULE_DISPLAY: Record<string, { name: string; description: string }> = {
  'module-pause-reflect': {
    name: 'Pause & Reflect',
    description: 'A guided 10-minute grounding practice: slow breathing, a brief body scan, and one written reflection to settle the nervous system between work demands.',
  },
};

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

/**
 * Turn a clinician/provider ID like "provider-dr-maya-rao" or a profile id
 * like "profile-aekta-brahmbhatt" into a readable name.
 */
function formatClinicianName(clinicianId: string): string {
  return clinicianId
    .replace(/^(provider|profile)-/, '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Minimal provider shape — enough to resolve name + actual-profile flag. */
interface ProviderInfo {
  id: string;
  profileId: string;
  name: string;
  isActualProfile?: boolean;
}

/**
 * Boundaries arrive as `{ items: string[] }` from the orchestrator — flatten
 * defensively so the list never renders as a raw object.
 */
function boundaryItems(boundaries: Record<string, unknown>): string[] {
  if (Array.isArray(boundaries)) return boundaries.map(String);
  const items = boundaries.items;
  return Array.isArray(items) ? items.map(String) : [];
}

export default function CarePlanPage(): React.ReactNode {
  const [carePlan, setCarePlan] = useState<CarePlanData | null>(null);
  const [, setActiveVersion] = useState<VersionData | null>(null);
  const [latestVersion, setLatestVersion] = useState<VersionData | null>(null);
  const [versions, setVersions] = useState<VersionData[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [userName, setUserName] = useState<string>('there');
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
    // Resolve provider names/flags so the clinician line matches the
    // professionals page treatment (actual profile vs fictional demo).
    fetch('/api/providers')
      .then((r) => (r.ok ? r.json() : { providers: [] }))
      .then((d) => { if (!cancelled) setProviders(d.providers ?? []); })
      .catch(() => { /* non-critical */ });
    // First name for the clinician's greeting.
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const name = d?.user?.displayName as string | undefined;
        if (!cancelled && name) setUserName(name.split(' ')[0]);
      })
      .catch(() => { /* non-critical */ });
    return () => { cancelled = true; };
  }, []);

  // The plan's clinicianId is the professional's profile id — match it to a
  // provider to pick up the display name and actual-profile flag.
  const clinicianProvider = carePlan
    ? providers.find((p) => p.profileId === carePlan.clinicianId)
    : undefined;
  const clinicianDisplayName = clinicianProvider?.name
    ?? (carePlan ? formatClinicianName(carePlan.clinicianId) : '');
  const isActualClinician = Boolean(clinicianProvider?.isActualProfile);

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

        {/* A note from your clinician — shown once the plan is active */}
        {carePlan && latestVersion && carePlan.overallStatus === 'ACTIVE' && (
          <section className="mb-8">
            <div className="bg-surface border border-primary/20 rounded-lg p-6 md:p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold">
                  {clinicianDisplayName.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <p className="text-sm font-medium text-text">A note from your clinician</p>
                  <p className="text-xs text-text-muted">
                    {clinicianDisplayName} · Counsellor &amp; Psychologist
                  </p>
                </div>
                <span className={`ml-auto inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusBadgeClass(latestVersion.status)}`}>
                  {versionLabel(latestVersion)}
                </span>
              </div>
              <div className="space-y-3 text-sm leading-relaxed text-text">
                <p className="font-medium">Dear {userName},</p>
                {CLINICIAN_NOTE.paragraphs.map((p, i) => (
                  <p key={i} className="text-text/90">{p}</p>
                ))}
                <p className="pt-2">{CLINICIAN_NOTE.closing}</p>
                <div>
                  <p className="font-medium text-primary">{clinicianDisplayName}</p>
                  <p className="text-xs text-text-muted">
                    Plan prepared {latestVersion.clinicianApprovedAt
                      ? new Date(latestVersion.clinicianApprovedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
                      : ''}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Current Care Plan Details — show latest version */}
        {carePlan && latestVersion && !hasV2 && (
          <section className="mb-8">
            <div className="bg-surface border border-text/10 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-text">
                  Your plan at a glance
                </h2>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusBadgeClass(latestVersion.status)}`}>
                  {latestVersion.status.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="space-y-5">
                <div>
                  <span className="text-sm font-medium text-text">Clinician:</span>
                  <span className="text-sm text-text-muted ml-2">{clinicianDisplayName}</span>
                  {isActualClinician ? (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                      Actual Profile
                    </span>
                  ) : (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">
                      Fictional demonstration
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-sm font-medium text-text">Goals:</span>
                  <div className="mt-3 space-y-4">
                    {latestVersion.goals.map((goal, idx) => {
                      const guidance = guidanceForGoal(goal) ?? GENERIC_GOAL_GUIDANCE;
                      const withImage = guidanceForGoal(goal);
                      return (
                        <div key={idx} className="border border-text/10 rounded-lg overflow-hidden bg-white">
                          {withImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={withImage.image}
                              alt={withImage.alt}
                              className="w-full h-44 object-cover"
                            />
                          )}
                          <div className="p-5">
                            <h3 className="text-base font-medium text-text mb-2">{goal}</h3>
                            <p className="text-sm leading-relaxed text-text/80 mb-3">{guidance.why}</p>
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
                              This week&rsquo;s practice
                            </p>
                            <ul className="space-y-2">
                              {guidance.practices.map((practice, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-text-muted">
                                  <span className="mt-0.5 text-primary">✓</span>
                                  <span>{practice}</span>
                                </li>
                              ))}
                            </ul>
                            <p className="mt-3 text-xs italic text-text-muted border-l-2 border-primary/30 pl-3">
                              {guidance.tip}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="text-sm font-medium text-text">Assigned Modules:</span>
                  <div className="mt-2 space-y-2">
                    {latestVersion.assignedModules.map((mod) => {
                      const display = MODULE_DISPLAY[mod];
                      return (
                        <div key={mod} className="border border-primary/20 bg-primary/5 rounded-lg p-4">
                          <div className="flex items-center gap-2">
                            <span className="text-primary">🌿</span>
                            <span className="text-sm font-medium text-text">
                              {display?.name ?? mod}
                            </span>
                            <Link href="/module/pause-reflect" className="ml-auto text-xs text-primary hover:underline">
                              Start practice →
                            </Link>
                          </div>
                          {display && (
                            <p className="mt-1 text-xs leading-relaxed text-text-muted">{display.description}</p>
                          )}
                          <p className="mt-2 text-[10px] italic text-text-muted">({BRAND.prototypeLabel})</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="text-sm font-medium text-text">Check-in Frequency:</span>
                  <span className="text-sm text-text-muted ml-2">
                    {latestVersion.checkInFrequency.replace(/_/g, ' ')}
                  </span>
                  <div className="mt-3 border border-text/10 rounded-lg p-4">
                    <p className="text-sm font-medium text-text mb-2">{WEEKLY_RHYTHM.heading}</p>
                    <ul className="space-y-2">
                      {WEEKLY_RHYTHM.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-text-muted">
                          <span aria-hidden>{item.icon}</span>
                          <span>{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <span className="text-sm font-medium text-text">{CARE_BOUNDARIES_HEADING}:</span>
                  <ul className="mt-1 space-y-1">
                    {boundaryItems(latestVersion.boundaries).map((item, idx) => (
                      <li key={idx} className="text-sm text-text-muted pl-4">
                        &bull; {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {latestVersion.followUpDate && (
                  <div>
                    <span className="text-sm font-medium text-text">Follow-up Date:</span>
                    <span className="text-sm text-text-muted ml-2">
                      {new Date(latestVersion.followUpDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    <p className="text-xs text-text-muted mt-1">
                      I will review your check-ins before this date and adjust the plan if needed.
                    </p>
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

        {/* Recommended resources from your clinician */}
        {carePlan && latestVersion && carePlan.overallStatus === 'ACTIVE' && (
          <section className="mb-8">
            <h2 className="text-lg font-medium text-text mb-1">Recommended reading</h2>
            <p className="text-sm text-text-muted mb-4">
              Hand-picked by {clinicianDisplayName} to complement your plan — start with whichever speaks to you.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {RESOURCES.map((r) => (
                <a
                  key={r.url}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-surface border border-text/10 rounded-lg p-5 hover:border-primary/40 hover:shadow-sm transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                      {r.tag}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-text-muted">{r.org}</span>
                    <span className="ml-auto text-primary text-sm" aria-hidden>↗</span>
                  </div>
                  <p className="text-sm font-medium text-text">{r.title}</p>
                  <p className="text-xs leading-relaxed text-text-muted mt-1">{r.description}</p>
                </a>
              ))}
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
                  <p><span className="font-medium text-text">Modules:</span> {v1.assignedModules.map((m) => MODULE_DISPLAY[m]?.name ?? m).join(', ')}</p>
                  <p>
                    <span className="font-medium text-text">{CARE_BOUNDARIES_HEADING}:</span>
                  </p>
                  <ul className="pl-3 space-y-0.5">
                    {boundaryItems(v1.boundaries).map((item, i) => (
                      <li key={i}>
                        &bull; {item}
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
                  <p><span className="font-medium text-text">Modules:</span> {v2.assignedModules.map((m) => MODULE_DISPLAY[m]?.name ?? m).join(', ')}</p>
                  <p>
                    <span className="font-medium text-text">{CARE_BOUNDARIES_HEADING}:</span>
                  </p>
                  <ul className="pl-3 space-y-0.5">
                    {boundaryItems(v2.boundaries).map((item, i) => {
                      const isNew = !boundaryItems(v1.boundaries).includes(item);
                      return (
                        <li key={i} className={isNew ? 'text-green-600 font-medium' : ''}>
                          &bull; {item}
                          {isNew ? ' (new)' : ''}
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
                        {MODULE_DISPLAY[m]?.name ?? m} <span className="ml-1 text-[10px] italic">({BRAND.prototypeLabel})</span>
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
