import Link from 'next/link';
import { BRAND } from '@/lib/config/brand';

export default function HandoffPage(): React.ReactNode {
  return (
    <main className="min-h-screen bg-background">
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 ${BRAND.spacing.sectionPadding}`}>
        <h1 className={`${BRAND.typography.headingSize} font-semibold text-text`}>Handoff</h1>
        <p className="mt-2 text-text-muted">Editable consent-controlled handoff to a professional. Coming soon.</p>
        <Link href="/" className="mt-6 inline-block text-primary hover:underline">← Back to Home</Link>
      </div>
    </main>
  );
}
