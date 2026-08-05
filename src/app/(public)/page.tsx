import { MarketingLanding } from '@/components/landing/MarketingLanding';

/**
 * Landing route — always the public marketing page (the app's front door).
 * Signed-in users get a short "Continue in Manas" shortcut from here into
 * their personal space at /home.
 */
export default function LandingPage(): React.ReactNode {
  return <MarketingLanding />;
}
