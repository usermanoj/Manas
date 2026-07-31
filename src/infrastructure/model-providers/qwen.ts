import { AIOutput, AIOutputSchema, SAFE_FALLBACK, ModelGateway, ModelGatewayContext } from '@/domain/ai';
import { env } from '@/lib/config/env';

/**
 * QwenModelGateway — Alibaba Cloud Model Studio (Qwen) implementation.
 *
 * Server-side only. Never exposes API key to the browser.
 * On any failure (timeout, API error, schema validation) returns SAFE_FALLBACK.
 */
export class QwenModelGateway implements ModelGateway {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxRetries = 1;

  constructor() {
    const apiKey = env.ALIBABA_QWEN_API_KEY;
    if (!apiKey) {
      throw new Error('QwenModelGateway: ALIBABA_QWEN_API_KEY is required when provider is "qwen".');
    }
    this.apiKey = apiKey;
    this.model = env.ALIBABA_QWEN_MODEL;
    this.timeoutMs = env.ALIBABA_QWEN_TIMEOUT_MS;
  }

  async generate(prompt: string, context: ModelGatewayContext): Promise<AIOutput> {
    // Validate input length (untrusted content guard)
    if (!prompt || prompt.length < 1 || prompt.length > 1000) {
      console.warn('[QwenModelGateway] Input length out of range', {
        sessionId: context.sessionId,
        turnNumber: context.turnNumber,
        inputLength: prompt?.length ?? 0,
      });
      return SAFE_FALLBACK;
    }

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.callQwenApi(prompt, context);
        // Validate structured output against schema
        const validated = AIOutputSchema.parse(result);
        console.info('[QwenModelGateway] Generation succeeded', {
          sessionId: context.sessionId,
          turnNumber: context.turnNumber,
          attempt,
          modelVersion: validated.model_version,
        });
        return validated;
      } catch (error) {
        lastError = error;
        console.warn('[QwenModelGateway] Attempt failed', {
          sessionId: context.sessionId,
          turnNumber: context.turnNumber,
          attempt,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // All attempts exhausted — return safe fallback
    console.error('[QwenModelGateway] All attempts exhausted, returning SAFE_FALLBACK', {
      sessionId: context.sessionId,
      turnNumber: context.turnNumber,
      lastErrorMessage: lastError instanceof Error ? lastError.message : String(lastError),
    });
    return SAFE_FALLBACK;
  }

  /**
   * Call the Alibaba Cloud Model Studio API with timeout and structured response parsing.
   */
  private async callQwenApi(
    prompt: string,
    context: ModelGatewayContext,
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(
        'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: 'system',
                content: 'You are a structured mental-health check-in assistant. Respond ONLY with valid JSON matching the required schema. Never include explanations or markdown.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 1024,
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'unreadable');
        throw new Error(`Qwen API returned ${response.status}: ${errorBody.slice(0, 200)}`);
      }

      const data = (await response.json()) as QwenApiResponse;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('Qwen API returned empty content');
      }

      // Parse the JSON content from the model response
      const parsed: Record<string, unknown> = JSON.parse(content) as Record<string, unknown>;

      // Inject metadata from context if not present
      if (!parsed.model_version) {
        parsed.model_version = this.model;
      }
      if (!parsed.prompt_version) {
        parsed.prompt_version = `prompt-v1`;
      }
      if (!parsed.language) {
        parsed.language = context.language;
      }

      return parsed;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Minimal type for the Qwen API response shape.
 */
interface QwenApiResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}
