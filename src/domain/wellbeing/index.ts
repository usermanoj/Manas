// ─── Archetypes ─────────────────────────────────────────────────────────────
export { CONCERN_ARCHETYPES, getArchetype, listArchetypes } from './archetypes';
export type { ConcernArchetype, ArchetypeDefinition } from './archetypes';

// ─── Technique Library ──────────────────────────────────────────────────────
export {
  WELLBEING_TECHNIQUES,
  getTechniqueById,
  getTechniquesForArchetype,
  listTechniques,
  getCitationsForTechniqueIds,
} from './technique-library';
export type { Technique, Citation } from './technique-library';

// ─── Symptom Inference ──────────────────────────────────────────────────────
export { inferSymptoms, applyUserSeverity, refineSymptomText } from './symptom-inference';
export type { InferredSymptom } from './symptom-inference';

// ─── Citation Service ───────────────────────────────────────────────────────
export {
  StaticCitationService,
  WebCitationService,
  HybridCitationService,
  buildCitationQuery,
} from './citation-service';
export type { CitationService, CitationQuery, CitationResult } from './citation-service';

// ─── Proactive Engine ───────────────────────────────────────────────────────
export { ProactiveWellbeingEngine } from './proactive-engine';
export type {
  ProactiveEngineInput,
  ProactiveResponse,
  PreviousSessionContext,
} from './proactive-engine';
