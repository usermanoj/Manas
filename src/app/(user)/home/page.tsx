import { SignedInHome } from '@/components/landing/SignedInHome';

/**
 * Personal space for signed-in users — the calm sanctuary with a greeting,
 * one primary action, and workspace tiles. Reached from the landing page's
 * "Continue in Manas" shortcut. Signed-out visitors are redirected to /.
 */
export default function PersonalSpacePage(): React.ReactNode {
  return <SignedInHome />;
}
