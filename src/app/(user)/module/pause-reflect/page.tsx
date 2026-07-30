import Link from 'next/link';
import { BRAND } from '@/lib/config/brand';

export default function PauseReflectPage(): React.ReactNode {
  return (
    <main className="min-h-screen bg-background">
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        <h1 className={`${BRAND.typography.headingSize} font-semibold text-text`}>Pause &amp; Reflect</h1>
        <p className="mt-2 text-text-muted">A guided wellbeing module for pausing and reflecting. Coming soon.</p>
        <p className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-text-muted">
          {BRAND.prototypeLabel}
        </p>
        <Link href="/" className="mt-6 inline-block text-primary hover:underline">← Back to Home</Link>
      </div>
    </main>
  );
}
