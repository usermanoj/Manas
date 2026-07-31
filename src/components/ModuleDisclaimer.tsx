import { BRAND } from '@/lib/config/brand';

export function ModuleDisclaimer(): React.ReactNode {
  return (
    <div data-testid="module-disclaimer" className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-text-muted mb-6">
      {BRAND.prototypeLabel}
    </div>
  );
}
