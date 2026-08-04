import { BRAND } from '@/lib/config/brand';

export function DisclosureBanner(): React.ReactNode {
  return (
    <div className="bg-secondary/10 border-b border-secondary/30">
      <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 py-2`}>
        <p className="text-xs md:text-sm text-text-muted text-center">
          {BRAND.disclosure}
        </p>
      </div>
    </div>
  );
}
