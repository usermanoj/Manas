import { SEED_CONTENT_MODULES, SEED_CONTENT_MODULE_VERSIONS } from '@/domain/repositories';
import { PauseReflectRunner } from '@/components/module/PauseReflectRunner';
import { Layout } from '@/components/Layout';

interface ModuleStep {
  order: number;
  instruction: string;
  durationSeconds: number;
}

interface ModuleData {
  id: string;
  title: string;
  purpose: string;
  status: string;
  steps: ModuleStep[];
  warnings: string[];
  contraindications: string[];
  escalationConditions: string[];
  reviewStatus: string;
}

/**
 * Pause & Reflect module page.
 * Loads the seeded module-pause-reflect content and renders the interactive runner.
 */
export default function PauseReflectPage(): React.ReactNode {
  const contentModule = SEED_CONTENT_MODULES.find((m) => m.id === 'module-pause-reflect');
  const version = SEED_CONTENT_MODULE_VERSIONS.find((v) => v.moduleId === 'module-pause-reflect');

  if (!contentModule || !version) {
    return (
      <Layout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-text-muted">Module not found.</p>
        </div>
      </Layout>
    );
  }

  const moduleData: ModuleData = {
    id: contentModule.id,
    title: contentModule.title,
    purpose: contentModule.purpose,
    status: contentModule.status,
    steps: version.steps.map((s) => ({
      order: s.order as number,
      instruction: s.instruction as string,
      durationSeconds: s.durationSeconds as number,
    })),
    warnings: version.warnings,
    contraindications: version.contraindications,
    escalationConditions: version.escalationConditions,
    reviewStatus: version.reviewStatus,
  };

  return (
    <Layout>
      <PauseReflectRunner module={moduleData} />
    </Layout>
  );
}
