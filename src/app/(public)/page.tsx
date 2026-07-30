import Link from 'next/link';
import { BRAND } from '@/lib/config/brand';

export default function LandingPage(): React.ReactNode {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* AI Disclosure - always visible */}
      <div className="bg-secondary/10 border-b border-secondary/30">
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 py-3`}>
          <p className="text-sm text-text-muted text-center">
            {BRAND.disclosure}
          </p>
        </div>
      </div>

      {/* Hero Section */}
      <section className={`flex-1 ${BRAND.spacing.sectionPadding}`}>
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4`}>
          <div className="text-center py-12 md:py-20">
            <h1 className={`text-4xl md:text-5xl font-bold text-primary mb-4`}>
              {BRAND.name}
            </h1>
            <p className={`${BRAND.typography.bodySize} text-text-muted mb-8`}>
              {BRAND.tagline}
            </p>
            <p className="text-base text-text-muted max-w-2xl mx-auto mb-12">
              A calm space to pause, reflect, and explore wellbeing resources
              designed for adults experiencing everyday work-related stress.
            </p>
          </div>

          {/* Language Selection */}
          <div className="bg-surface rounded-lg shadow-sm border border-text/10 p-6 mb-6 max-w-md mx-auto">
            <h2 className="text-lg font-semibold text-text mb-4">Language</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="language"
                  value="en"
                  defaultChecked
                  className="w-4 h-4 text-primary"
                />
                <span className="text-text">English</span>
              </label>
              <label className="flex items-center gap-3 cursor-not-allowed opacity-60">
                <input
                  type="radio"
                  name="language"
                  value="hi"
                  disabled
                  className="w-4 h-4"
                />
                <span className="text-text">
                  Hindi / Hinglish
                  <span className="ml-2 text-xs bg-warning/20 text-warning px-2 py-0.5 rounded">
                    Coming soon — PENDING_REVIEW
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="bg-surface rounded-lg shadow-sm border border-text/10 p-6 mb-8 max-w-md mx-auto">
            <h2 className="text-lg font-semibold text-text mb-4">How would you like to begin?</h2>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="guest"
                  defaultChecked
                  className="w-4 h-4 mt-1 text-primary"
                />
                <div>
                  <p className="font-medium text-text">Guest Mode</p>
                  <p className="text-sm text-text-muted">Try the demo without creating an account</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="connected"
                  className="w-4 h-4 mt-1 text-primary"
                />
                <div>
                  <p className="font-medium text-text">Connected Care</p>
                  <p className="text-sm text-text-muted">Sign in for the full experience with memory and handoff</p>
                </div>
              </label>
            </div>
          </div>

          {/* CTA Button */}
          <div className="text-center">
            <Link
              href="/check-in"
              className="inline-block bg-primary hover:bg-primary-light text-white font-semibold px-8 py-4 rounded-lg text-lg transition-colors shadow-sm"
            >
              Begin Check-In
            </Link>
          </div>

          {/* Hackathon Disclaimer */}
          <div className="mt-12 text-center">
            <p className="text-sm text-text-muted bg-accent/10 border border-accent/30 rounded-lg p-4 max-w-2xl mx-auto">
              {BRAND.hackathonDisclaimer} All professional profiles are fictional demo profiles.
            </p>
          </div>
        </div>
      </section>

      {/* Footer - Not an emergency service */}
      <footer className="bg-surface border-t border-text/10">
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 py-4 text-center`}>
          <p className="text-sm text-text-muted font-medium">
            Not an emergency service. If you are in crisis, please contact local emergency services.
          </p>
        </div>
      </footer>
    </div>
  );
}
