import { z } from 'zod';

const envSchema = z.object({
  MANAS_AI_PROVIDER: z.enum(['mock', 'qwen']).default('mock'),
  ALIBABA_QWEN_API_KEY: z.string().optional(),
  ALIBABA_QWEN_MODEL: z.string().default('qwen-plus'),
  ALIBABA_QWEN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Parse env vars safely — works in both Node and edge runtimes.
 * Falls back to safe defaults when env vars are unavailable.
 */
function loadEnv(): EnvConfig {
  try {
    return envSchema.parse({
      MANAS_AI_PROVIDER: process.env.MANAS_AI_PROVIDER,
      ALIBABA_QWEN_API_KEY: process.env.ALIBABA_QWEN_API_KEY,
      ALIBABA_QWEN_MODEL: process.env.ALIBABA_QWEN_MODEL,
      ALIBABA_QWEN_TIMEOUT_MS: process.env.ALIBABA_QWEN_TIMEOUT_MS,
    });
  } catch {
    // Safe defaults when env vars unavailable
    return {
      MANAS_AI_PROVIDER: 'mock',
      ALIBABA_QWEN_MODEL: 'qwen-plus',
      ALIBABA_QWEN_TIMEOUT_MS: 10000,
    };
  }
}

export const env = loadEnv();
