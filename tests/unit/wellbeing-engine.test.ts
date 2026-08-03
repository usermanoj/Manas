import { describe, it, expect } from 'vitest';
import {
  ProactiveWellbeingEngine,
  StaticCitationService,
  inferSymptoms,
  getTechniquesForArchetype,
  getArchetype,
  refineSymptomText,
  type CitationService,
  type CitationQuery,
  type CitationResult,
} from '@/domain/wellbeing';

class MockCitationService implements CitationService {
  async search(query: CitationQuery): Promise<CitationResult> {
    return {
      citations: [
        {
          source: 'Mock Source',
          title: `Mock citation for ${query.query}`,
          url: 'https://example.com/mock',
          description: 'Mock citation for testing.',
        },
      ],
      source: 'static',
      query: query.query,
    };
  }
}

describe('Wellbeing Engine', () => {
  describe('archetype classification', () => {
    it('classifies anxiety from physical and cognitive worry language', async () => {
      const engine = new ProactiveWellbeingEngine({ citationService: new MockCitationService() });
      const res = await engine.process({
        message: 'My heart races and I cannot stop worrying that something terrible will happen.',
      });

      expect(res.primaryArchetype).toBe('anxiety');
      expect(res.archetypes).toContain('anxiety');
      expect(res.validation.toLowerCase()).toContain('anxiety');
    });

    it('classifies sleep disturbance with anxiety co-occurrence', async () => {
      const engine = new ProactiveWellbeingEngine({ citationService: new MockCitationService() });
      const res = await engine.process({
        message: 'I wake up at 3am every night and my heart is racing. I cannot focus at work.',
      });

      expect(res.archetypes).toContain('sleep_disturbance');
      expect(res.techniques.length).toBeGreaterThan(0);
    });

    it('classifies burnout from chronic depletion language', async () => {
      const engine = new ProactiveWellbeingEngine({ citationService: new MockCitationService() });
      const res = await engine.process({
        message: 'I am completely burned out from work. I have no energy left and I feel hollow.',
      });

      expect(res.primaryArchetype).toBe('burnout');
      expect(res.techniques.some((t) => t.frameworks.includes('ACT'))).toBe(true);
    });

    it('falls back to general wellbeing for neutral input', async () => {
      const engine = new ProactiveWellbeingEngine({ citationService: new MockCitationService() });
      const res = await engine.process({
        message: 'I just wanted to check in today.',
      });

      expect(res.primaryArchetype).toBe('general_wellbeing');
      expect(res.followUpQuestions.length).toBeGreaterThan(0);
    });
  });

  describe('symptom inference', () => {
    it('infers sleep and mood symptoms from a complex message', () => {
      const symptoms = inferSymptoms(
        'I have been waking up at 3am every night with a racing heart and I feel overwhelmed.',
      );

      const categories = symptoms.map((s) => s.category);
      expect(categories).toContain('sleep');
      expect(categories).toContain('mood');
    });

    it('infers severity from language intensity', () => {
      const symptoms = inferSymptoms('I have severe insomnia every night and I cannot function.');
      const sleepSymptom = symptoms.find((s) => s.category === 'sleep');
      expect(sleepSymptom?.severity).toBe('severe');
    });

    it('refines symptom text from source phrase', () => {
      const symptoms = inferSymptoms('I have been waking up at 3am every night.');
      const refined = refineSymptomText(symptoms[0]);
      expect(refined.toLowerCase()).toContain('3am');
    });
  });

  describe('technique selection', () => {
    it('returns crisis-appropriate techniques for severe distress', async () => {
      const engine = new ProactiveWellbeingEngine({ citationService: new MockCitationService() });
      const res = await engine.process({
        message: 'I am panicking and my heart is racing uncontrollably.',
      });

      expect(res.techniques.some((t) => t.isCrisisAppropriate)).toBe(true);
      expect(res.techniques.length).toBeLessThanOrEqual(2);
    });

    it('includes citations for selected techniques', async () => {
      const engine = new ProactiveWellbeingEngine({ citationService: new MockCitationService() });
      const res = await engine.process({
        message: 'I feel really anxious before meetings.',
      });

      expect(res.citations.length).toBeGreaterThan(0);
      expect(res.citations[0].source).toBeDefined();
    });
  });

  describe('safety scan', () => {
    it('raises safety flag for crisis language', async () => {
      const engine = new ProactiveWellbeingEngine({ citationService: new MockCitationService() });
      const res = await engine.process({
        message: 'I want to end my life.',
      });

      expect(res.safetyFlag).toBe(true);
      expect(res.safetyMessage).toContain('988');
      expect(res.followUpQuestions).toHaveLength(0);
      expect(res.suggestedRoutingIndicator).toBe('human_review_required');
    });

    it('does not raise safety flag for ordinary distress', async () => {
      const engine = new ProactiveWellbeingEngine({ citationService: new MockCitationService() });
      const res = await engine.process({
        message: 'Work has been stressful this week.',
      });

      expect(res.safetyFlag).toBe(false);
      expect(res.followUpQuestions.length).toBeGreaterThan(0);
    });
  });

  describe('cross-session memory', () => {
    it('surfaces pattern when the same archetype recurs', async () => {
      const engine = new ProactiveWellbeingEngine({ citationService: new MockCitationService() });
      const res = await engine.process({
        message: 'I am overwhelmed again at work.',
        previousSessions: [
          {
            id: 's1',
            date: new Date(Date.now() - 86400000).toISOString(),
            primaryArchetype: 'stress',
            keyPoints: ['work overload'],
            techniquesUsed: ['box_breathing'],
          },
          {
            id: 's2',
            date: new Date(Date.now() - 172800000).toISOString(),
            primaryArchetype: 'stress',
            keyPoints: ['deadline pressure'],
            techniquesUsed: ['box_breathing'],
          },
        ],
      });

      expect(res.crossSessionInsight).toBeDefined();
      expect(res.crossSessionInsight?.toLowerCase()).toContain('3th time');
    });
  });

  describe('static citation service', () => {
    it('returns curated citations for a technique query', async () => {
      const service = new StaticCitationService();
      const result = await service.search({ query: 'box breathing', techniqueIds: ['box_breathing'] });

      expect(result.citations.length).toBeGreaterThan(0);
      expect(result.citations.some((c) => c.source.includes('Hopper'))).toBe(true);
    });
  });

  describe('archetype helpers', () => {
    it('returns techniques mapped to an archetype', () => {
      const techniques = getTechniquesForArchetype('anxiety');
      expect(techniques.length).toBeGreaterThan(0);
      expect(techniques.some((t) => t.id === '5_4_3_2_1_grounding')).toBe(true);
    });

    it('returns archetype definition', () => {
      const def = getArchetype('burnout');
      expect(def.label).toBe('Burnout or exhaustion');
      expect(def.suggestedTechniqueIds.length).toBeGreaterThan(0);
    });
  });
});
