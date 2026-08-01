import { Suspense } from 'react';
import { Layout } from '@/components/Layout';
import ClinicianCarePlanClient from './ClinicianCarePlanClient';

export const dynamic = 'force-dynamic';

export default function ClinicianCarePlanPage(): React.ReactNode {
  return (
    <Layout>
      <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><p className="text-text-muted">Loading…</p></div>}>
        <ClinicianCarePlanClient />
      </Suspense>
    </Layout>
  );
}
