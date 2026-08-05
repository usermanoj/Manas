'use client';

interface SymptomEntry {
  id: string;
  sessionId?: string;
  text: string;
  category: string;
  severity: string;
  frequency: string;
  impact: string;
  createdAt: string;
}

interface SymptomBucketsProps {
  symptoms: SymptomEntry[];
  onDelete?: (id: string) => void;
  onEdit?: (entry: SymptomEntry) => void;
  deletingId?: string | null;
  /** Id of the active check-in session — entries captured in it get a badge. */
  currentSessionId?: string | null;
  readOnly?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  sleep: 'Sleep',
  mood: 'Mood',
  energy: 'Energy',
  focus: 'Focus',
  physical_tension: 'Physical tension',
  social: 'Social',
  work_stress: 'Work stress',
  other: 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
  sleep: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  mood: 'bg-rose-100 text-rose-800 border-rose-200',
  energy: 'bg-amber-100 text-amber-800 border-amber-200',
  focus: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  physical_tension: 'bg-orange-100 text-orange-800 border-orange-200',
  social: 'bg-teal-100 text-teal-800 border-teal-200',
  work_stress: 'bg-purple-100 text-purple-800 border-purple-200',
  other: 'bg-gray-100 text-gray-800 border-gray-200',
};

const SEVERITY_COLORS: Record<string, string> = {
  mild: 'bg-green-100 text-green-800',
  moderate: 'bg-yellow-100 text-yellow-800',
  significant: 'bg-orange-100 text-orange-800',
  severe: 'bg-red-100 text-red-800',
};

export function SymptomBuckets({ symptoms, onDelete, onEdit, deletingId, currentSessionId, readOnly }: SymptomBucketsProps): React.ReactNode {
  if (symptoms.length === 0) {
    return (
      <div className="bg-surface border border-text/10 rounded-xl p-6 text-center">
        <p className="text-text-muted text-sm">No symptoms recorded yet.</p>
        <p className="text-xs text-text-muted mt-1">
          Anything you confirm during a check-in appears here automatically — or add one manually.
        </p>
      </div>
    );
  }

  const grouped = symptoms.reduce<Record<string, SymptomEntry[]>>((acc, s) => {
    const key = s.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([category, entries]) => (
        <div
          key={category}
          className={`rounded-xl border p-4 ${CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other}`}
        >
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold">{CATEGORY_LABELS[category] ?? category}</h3>
            <span className="text-xs opacity-75">({entries.length})</span>
          </div>
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="bg-white/60 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-text">{entry.text}</p>
                    {currentSessionId && entry.sessionId === currentSessionId && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Saved from this check-in
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">Impact: {entry.impact}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${SEVERITY_COLORS[entry.severity] ?? 'bg-gray-100 text-gray-800'}`}>
                    {entry.severity}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/80 text-text">
                    {entry.frequency.replace(/_/g, ' ')}
                  </span>
                  {!readOnly && onEdit && (
                    <button
                      onClick={() => onEdit(entry)}
                      className="text-xs text-primary hover:text-primary-light font-medium"
                    >
                      Edit
                    </button>
                  )}
                  {!readOnly && onDelete && (
                    <button
                      onClick={() => onDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                    >
                      {deletingId === entry.id ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
