import { z } from 'zod';

const baseSchema = z.object({
  MANAS_AI_PROVIDER: z.enum(['mock', 'qwen']).default('mock'),
  ALIBABA_QWEN_API_KEY: z.string().optional(),
  ALIBABA_QWEN_MODEL: z.string().default('qwen-plus'),
  ALIBABA_QWEN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  MANAS_PERSISTENCE: z.enum(['memory', 'supabase']).default('memory'),
  MANAS_DEMO_MODE: z.string().default('true'),
  MANAS_SUPABASE_TEST_ENABLED: z.string().default('false'),
  SUPABASE_TEST_USER_EMAIL: z.string().optional(),
  SUPABASE_TEST_USER_PASSWORD: z.string().optional(),
});

const supabaseRequiredSchema = z.object({
  SUPABASE_URL: z.string().min(1, 'SUPABASE_URL is required when MANAS_PERSISTENCE=supabase'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required when MANAS_PERSISTENCE=supabase'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required when MANAS_PERSISTENCE=supabase'),
});

const supabaseOptionalSchema = z.object({
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

export type EnvConfig = z.infer<typeof baseSchema> & {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

/**
 * Parse env vars safely — works in both Node and edge runtimes.
 * Falls back to safe defaults when env vars are unavailable.
 * Supabase vars are required only when MANAS_PERSISTENCE=supabase.
 */
function loadEnv(): EnvConfig {
  try {
    const raw = {
      MANAS_AI_PROVIDER: process.env.MANAS_AI_PROVIDER,
      ALIBABA_QWEN_API_KEY: process.env.ALIBABA_QWEN_API_KEY,
      ALIBABA_QWEN_MODEL: process.env.ALIBABA_QWEN_MODEL,
      ALIBABA_QWEN_TIMEOUT_MS: process.env.ALIBABA_QWEN_TIMEOUT_MS,
      MANAS_PERSISTENCE: process.env.MANAS_PERSISTENCE,
      MANAS_DEMO_MODE: process.env.MANAS_DEMO_MODE,
      MANAS_SUPABASE_TEST_ENABLED: process.env.MANAS_SUPABASE_TEST_ENABLED,
      SUPABASE_TEST_USER_EMAIL: process.env.SUPABASE_TEST_USER_EMAIL,
      SUPABASE_TEST_USER_PASSWORD: process.env.SUPABASE_TEST_USER_PASSWORD,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };

    const base = baseSchema.parse(raw);

    const supabaseSchema =
      base.MANAS_PERSISTENCE === 'supabase' ? supabaseRequiredSchema : supabaseOptionalSchema;
    const supabase = supabaseSchema.parse(raw);

    return { ...base, ...supabase };
  } catch {
    // Safe defaults when env vars unavailable
    return {
      MANAS_AI_PROVIDER: 'mock',
      ALIBABA_QWEN_MODEL: 'qwen-plus',
      ALIBABA_QWEN_TIMEOUT_MS: 10000,
      MANAS_PERSISTENCE: 'memory',
      MANAS_DEMO_MODE: 'true',
      MANAS_SUPABASE_TEST_ENABLED: 'false',
    };
  }
}

export const env = loadEnv();
