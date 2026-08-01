import Link from 'next/link';
import { BRAND } from '@/lib/config/brand';

export default function ClinicianContentPage(): React.ReactNode {
  return (
    <main className="min-h-screen bg-background">
      {/* Banner */}
      <div className="bg-secondary/10 border-b border-secondary/30">
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 py-3`}>
          <p className="text-sm text-text-muted text-center">
            Fictional clinician workspace — all people, handoffs and content modules shown here are
            synthetic demonstration data. {BRAND.prototypeLabel}
          </p>
        </div>
      </div>

      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        <h1 className={`${BRAND.typography.headingSize} font-semibold text-text`}>Content Compiler</h1>
        <p className="mt-2 text-text-muted">Review and manage wellbeing content modules. Coming soon.</p>
        <Link href="/" className="mt-6 inline-block text-primary hover:underline">← Back to Home</Link>
      </div>
    </main>
  );
}
