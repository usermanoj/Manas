import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client for use in Route Handlers and server-side code.
 * Uses the anon key — RLS policies are enforced per authenticated user.
 */
export function createServerSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('Missing required environment variable: SUPABASE_URL');
  }
  if (!anonKey) {
    throw new Error('Missing required environment variable: SUPABASE_ANON_KEY');
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Creates a Supabase admin client with service-role privileges.
 * Use ONLY for manual seed scripts and background migrations.
 *
 * WARNING: This client bypasses all RLS policies. Never expose to browser.
 */
export function createAdminSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('Missing required environment variable: SUPABASE_URL');
  }
  if (!serviceRoleKey) {
    throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
