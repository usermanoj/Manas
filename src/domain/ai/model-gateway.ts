import { AIOutput, AIOutputSchema, SAFE_FALLBACK } from './schemas';

/**
 * Context passed to the model gateway with each generation request.
 */
export interface ModelGatewayContext {
  sessionId: string;
  language: 'en' | 'hi' | 'hi-hinglish';
  turnNumber: number;
  previousExtractedUpdates: Record<string, unknown>;
}

/**
 * ModelGateway — abstraction over AI model providers.
 * Implementations: MockModelGateway (P0 fallback), QwenModelGateway (Day 2).
 */
export interface ModelGateway {
  generate(prompt: string, context: ModelGatewayContext): Promise<AIOutput>;
}

/**
 * Build a deterministic turn-1 response acknowledging the user's concern.
 */
function buildTurn1Response(language: ModelGatewayContext['language']): string {
  if (language === 'hi') {
    return 'धन्यवाद। आपने जो साझा किया है उसे मैं सुन रहा हूँ। क्या आप बता सकते हैं कि यह कब से चल रहा है?';
  }
  if (language === 'hi-hinglish') {
    return 'Thank you for sharing that with me. Aap kitne time se ye feel kar rahe hain?';
  }
  return 'Thank you for sharing that with me. I hear what you\'re going through at work. How long have you been feeling this way?';
}

/**
 * Build a deterministic turn-2 response asking about duration.
 */
function buildTurn2Response(language: ModelGatewayContext['language']): string {
  if (language === 'hi') {
    return 'समझ गया। क्या इसका असर आपकी नींद पर भी पड़ रहा है?';
  }
  if (language === 'hi-hinglish') {
    return 'Samajh gaya. Kya ye aapki neend ko bhi affect kar raha hai?';
  }
  return 'I understand. Has this been affecting your sleep at all?';
}

/**
 * Build a deterministic turn-3 response asking about sleep impact.
 */
function buildTurn3Response(language: ModelGatewayContext['language']): string {
  if (language === 'hi') {
    return 'नींद बहुत महत्वपूर्ण है। क्या आप बता सकते हैं कि यह आपके रोज़मर्रा के काम को कैसे प्रभावित कर रहा है?';
  }
  if (language === 'hi-hinglish') {
    return 'Neend important hai. Kya ye aapke daily kaam ko bhi affect kar raha hai?';
  }
  return 'Sleep is really important for wellbeing. How is this affecting your daily routine and work performance?';
}

/**
 * Build a deterministic turn-4 response asking about daily functioning.
 */
function buildTurn4Response(language: ModelGatewayContext['language']): string {
  if (language === 'hi') {
    return 'क्या आप कोई ऐसे तरीके जानना चाहेंगे जो आपकी मदद कर सकते हैं?';
  }
  if (language === 'hi-hinglish') {
    return 'Kya aap kuch aise tarike jaanna chahenge jo help kar sakte hain?';
  }
  return 'That sounds tough. Would you like to explore some approaches that might help you manage this?';
}

/**
 * Build a deterministic turn-5 response asking about support preference.
 */
function buildTurn5Response(language: ModelGatewayContext['language']): string {
  if (language === 'hi') {
    return 'क्या आप पेशेवर सहायता के बारे में बात करना चाहेंगे, या अभी सामान्य चिंतन से मदद मिलेगी?';
  }
  if (language === 'hi-hinglish') {
    return 'Kya aap professional support ke baare mein baat karna chahenge, ya general reflection se help milegi?';
  }
  return 'Would you find it helpful to talk to a professional, or would you prefer some self-reflection exercises first?';
}

/**
 * Build a deterministic turn-6 response summarizing and suggesting next steps.
 */
function buildTurn6Response(language: ModelGatewayContext['language']): string {
  if (language === 'hi') {
    return 'आज आपने जो साझा किया उसके लिए धन्यवाद। मैं आपके अनुभव को संक्षेप में प्रस्तुत कर रहा हूँ। जब आप तैयार हों, आप किसी पेशेवर से बात कर सकते हैं।';
  }
  if (language === 'hi-hinglish') {
    return 'Thanks for sharing today. Main aapke experience ko summarize kar raha hoon. Jab aap ready ho, aap kisi professional se bhi baat kar sakte ho.';
  }
  return 'Thank you for sharing today. I\'ve put together a summary of what you\'ve described. When you\'re ready, you can review it and decide if you\'d like to connect with a professional for further support.';
}

/**
 * Select the appropriate response text for a given turn number and language.
 */
function selectResponseForTurn(turnNumber: number, language: ModelGatewayContext['language']): string {
  if (turnNumber <= 1) return buildTurn1Response(language);
  if (turnNumber === 2) return buildTurn2Response(language);
  if (turnNumber === 3) return buildTurn3Response(language);
  if (turnNumber === 4) return buildTurn4Response(language);
  if (turnNumber === 5) return buildTurn5Response(language);
  return buildTurn6Response(language);
}

/**
 * Select the appropriate follow-up question type for a given turn number.
 */
function selectFollowUpForTurn(turnNumber: number): AIOutput['requested_follow_up'] {
  if (turnNumber <= 1) return 'duration';
  if (turnNumber === 2) return 'sleep_impact';
  if (turnNumber === 3) return 'functioning';
  if (turnNumber === 4) return 'support_preference';
  if (turnNumber === 5) return 'safety_check';
  return 'none';
}

/**
 * Select routing indicators based on turn progression.
 */
function selectRoutingIndicators(turnNumber: number): AIOutput['routing_indicators'] {
  if (turnNumber <= 1) return ['stress_indicators'];
  if (turnNumber === 2) return ['stress_indicators', 'sleep_disruption'];
  if (turnNumber === 3) return ['stress_indicators', 'sleep_disruption', 'functional_impact'];
  if (turnNumber >= 5) return ['stress_indicators', 'sleep_disruption', 'functional_impact', 'support_readiness'];
  return ['stress_indicators'];
}

/**
 * Build extracted updates based on turn context.
 */
function buildExtractedUpdates(
  turnNumber: number,
  previousExtractedUpdates: Record<string, unknown>
): Record<string, unknown> {
  if (turnNumber <= 1) return { ...previousExtractedUpdates };
  if (turnNumber === 2) return { ...previousExtractedUpdates, concern_noted: true };
  if (turnNumber === 3) return { ...previousExtractedUpdates, concern_noted: true, sleep_inquired: true };
  if (turnNumber === 4) {
    return { ...previousExtractedUpdates, concern_noted: true, sleep_inquired: true, functioning_inquired: true };
  }
  if (turnNumber === 5) {
    return {
      ...previousExtractedUpdates,
      concern_noted: true,
      sleep_inquired: true,
      functioning_inquired: true,
      support_preference_inquired: true,
    };
  }
  return {
    ...previousExtractedUpdates,
    concern_noted: true,
    sleep_inquired: true,
    functioning_inquired: true,
    support_preference_inquired: true,
    check_in_complete: true,
  };
}

/**
 * Mock ModelGateway — returns deterministic structured JSON matching AIOutputSchema.
 * Used as P0 fallback and for testing. Swapping to real provider is a config change.
 */
export class MockModelGateway implements ModelGateway {
  async generate(_prompt: string, context: ModelGatewayContext): Promise<AIOutput> {
    const { turnNumber, language, previousExtractedUpdates } = context;

    const isFinalTurn = turnNumber >= 6;

    const rawOutput = {
      user_facing_response: selectResponseForTurn(turnNumber, language),
      extracted_updates: buildExtractedUpdates(turnNumber, previousExtractedUpdates),
      requested_follow_up: selectFollowUpForTurn(turnNumber),
      routing_indicators: selectRoutingIndicators(turnNumber),
      content_module_request: isFinalTurn ? 'pause_reflect' as const : null,
      tool_request: null,
      unsupported_clinical_claims: [],
      language,
      confidence: isFinalTurn ? 0.92 : 0.75 + (turnNumber * 0.03),
      model_version: 'mock-v1',
      prompt_version: 'prompt-v1',
    };

    // Validate against schema before returning — throws if invalid
    return AIOutputSchema.parse(rawOutput);
  }
}

/**
 * FallbackModelGateway — always returns the SAFE_FALLBACK response.
 * Used when the real model is unavailable or returns invalid output.
 */
export class FallbackModelGateway implements ModelGateway {
  async generate(_prompt: string, _context: ModelGatewayContext): Promise<AIOutput> {
    void _prompt;
    void _context;
    return SAFE_FALLBACK;
  }
}
