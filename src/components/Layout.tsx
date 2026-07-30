import Link from 'next/link';
import { BRAND } from '@/lib/config/brand';
import { DisclosureBanner } from '@/components/DisclosureBanner';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps): React.ReactNode {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-surface border-b border-text/10">
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 py-4 flex items-center justify-between`}>
          <Link href="/" className="text-xl font-semibold text-primary">
            {BRAND.name}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/check-in" className="text-text-muted hover:text-primary transition-colors">
              Check-In
            </Link>
            <Link href="/summary" className="text-text-muted hover:text-primary transition-colors">
              Summary
            </Link>
            <Link href="/care-plan" className="text-text-muted hover:text-primary transition-colors">
              Care Plan
            </Link>
          </nav>
        </div>
      </header>
      <DisclosureBanner />
      <main>{children}</main>
      <footer className="bg-surface border-t border-text/10 mt-auto">
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 py-4 text-center`}>
          <p className="text-sm text-text-muted">
            Not an emergency service. If you are in crisis, please contact local emergency services.
          </p>
        </div>
      </footer>
    </div>
  );
}
