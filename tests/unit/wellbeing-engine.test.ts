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
      // Turn 1 emphasizes regulation/relief; ACT-based techniques surface at deeper stages.
      const deepRes = await engine.process({
        message: 'I am completely burned out from work. I have no energy left and I feel hollow.',
        turnNumber: 3,
      });
      expect(deepRes.techniques.some((t) => t.frameworks.includes('ACT'))).toBe(true);
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

    it('captures focus and fear as distinct symptoms for "unable to focus, fearful"', () => {
      const symptoms = inferSymptoms('unable to focus, fearful');
      const texts = symptoms.map((s) => s.text);
      expect(texts).toContain('Difficulty concentrating');
      expect(texts).toContain('Fear or dread');
    });

    it('captures anxiety, fear and physical discomfort for "anxious fearful giddy"', () => {
      const symptoms = inferSymptoms('anxious fearful giddy');
      const texts = symptoms.map((s) => s.text);
      expect(texts).toContain('Anxiety or worry');
      expect(texts).toContain('Fear or dread');
      expect(texts).toContain('Physical tension or discomfort');
    });

    it('captures anxiety, low energy and low mood for "anxious, sleepy, do not feel loke doing anything"', () => {
      // 'loke' is a common typo for 'like' — the 'doing anything' phrase still catches it.
      const symptoms = inferSymptoms('anxious, sleepy, do not feel loke doing anything');
      const texts = symptoms.map((s) => s.text);
      expect(texts).toContain('Anxiety or worry');
      expect(texts).toContain('Low energy or fatigue');
      expect(texts).toContain('Low mood');
    });

    it('captures appetite changes including common misspellings', () => {
      const symptoms = inferSymptoms("apetitite also not good, don't like anaything");
      const texts = symptoms.map((s) => s.text);
      expect(texts).toContain('Appetite changes');
    });

    it('captures fear for a short "fearful too" follow-up', () => {
      const symptoms = inferSymptoms('fearful too');
      expect(symptoms.map((s) => s.text)).toContain('Fear or dread');
    });

    it('captures sleep disturbance despite the "unabel" typo', () => {
      const symptoms = inferSymptoms('unabel to sleep');
      expect(symptoms.map((s) => s.text)).toContain('Sleep disturbance');
    });

    it('captures mobility difficulty for "can\'t walk also"', () => {
      const symptoms = inferSymptoms("can't walk also");
      expect(symptoms.map((s) => s.text)).toContain('Mobility or movement difficulty');
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

    it('classifies typo-laden sleep input as sleep archetype, not generic', async () => {
      const engine = new ProactiveWellbeingEngine({ citationService: new MockCitationService() });
      const res = await engine.process({ message: 'unabel to sleep', turnNumber: 2 });

      expect(res.primaryArchetype).toBe('sleep_disturbance');
      expect(res.validation.toLowerCase()).toContain('sleep');
    });

    it('never repeats techniques across consecutive turns of the same session', async () => {
      const engine = new ProactiveWellbeingEngine({ citationService: new MockCitationService() });
      const turn2 = await engine.process({ message: 'unabel to sleep', turnNumber: 2 });
      const turn3 = await engine.process({
        message: "can't walk also",
        turnNumber: 3,
        sessionTechniques: turn2.techniques.map((t) => t.id),
      });

      const turn2Ids = turn2.techniques.map((t) => t.id);
      const turn3Ids = turn3.techniques.map((t) => t.id);
      expect(turn3Ids.some((id) => turn2Ids.includes(id))).toBe(false);
      expect(turn3.techniques.length).toBeGreaterThan(0);
    });
  });

  describe('wrap-up and summarization', () => {
    it('treats "summarize and next steps" as an explicit wrap-up request', async () => {
      const engine = new ProactiveWellbeingEngine({ citationService: new MockCitationService() });
      const res = await engine.process({
        message: 'summarize and next steps',
        turnNumber: 5,
        sessionUserMessages: ['anxious sleepy', 'unabel to sleep'],
      });

      expect(res.readiness).toBe('ready_to_summarize');
      // Recap draws on the whole session, not just the wrap-up message.
      expect(res.validation).toContain('anxiety or worry');
      expect(res.validation).toContain('sleep disturbance');
      expect(res.validation).toContain('Summarize & next steps');
    });

    it('treats "not sure what else i should tell" as a wrap-up signal', async () => {
      const engine = new ProactiveWellbeingEngine({ citationService: new MockCitationService() });
      const res = await engine.process({
        message: 'not sure what else i should tell',
        turnNumber: 4,
      });

      expect(res.readiness).toBe('ready_to_summarize');
    });

    it('never falls back to the raw archetype label in the stage-4 recap', async () => {
      const engine = new ProactiveWellbeingEngine({ citationService: new MockCitationService() });
      const res = await engine.process({ message: 'ok then', turnNumber: 4 });

      expect(res.validation).not.toContain('general wellbeing check-in');
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
