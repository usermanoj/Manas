import 'server-only';
import type { AuditEvent } from '@/domain/repositories/types';
import type { AuditLogger } from '@/domain/audit/logger';
import { createAdminSupabaseClient, createServerSupabaseClient } from './supabase-client';
import { toCamelCase } from './supabase-repository';

/**
 * Supabase-backed AuditLogger implementation.
 *
 * - log() uses the admin (service_role) client — audit_events INSERT is
 *   restricted to service_role only (no user-facing INSERT policy).
 * - findAll() uses the server (anon) client — RLS scopes reads to user_id.
 *
 * Audit records are immutable append-only: no update() or delete().
 */

/**
 * Convert a DB row to an AuditEvent domain entity.
 */
function rowToEntity(row: Record<string, unknown>): AuditEvent {
  const camel = toCamelCase(row) as Record<string, unknown>;
  return {
    id: camel.id as string,
    timestamp: new Date(camel.timestamp as string),
    requestId: camel.requestId as string,
    userId: camel.userId as string,
    actor: camel.actor as string,
    eventType: camel.eventType as string,
    details: (camel.details as Record<string, unknown>) ?? {},
    policyVersion: camel.policyVersion as string | undefined,
    modelVersion: camel.modelVersion as string | undefined,
    promptVersion: camel.promptVersion as string | undefined,
  };
}

export class SupabaseAuditLogger implements AuditLogger {
  /**
   * Insert an audit event into the audit_events table.
   * Uses service_role client — RLS does not allow user INSERT.
   */
  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const admin = createAdminSupabaseClient();
    const row: Record<string, unknown> = {
      request_id: event.requestId,
      user_id: event.userId,
      actor: event.actor,
      event_type: event.eventType,
      details: event.details,
      policy_version: event.policyVersion ?? null,
      model_version: event.modelVersion ?? null,
      prompt_version: event.promptVersion ?? null,
    };

    const { error } = await admin.from('audit_events').insert(row);
    if (error) {
      // Audit failures should not crash the app — log to console for ops visibility
      console.error(`[SupabaseAuditLogger] Failed to insert audit event: ${error.message}`);
    }
  }

  /**
   * Read audit events scoped to the current authenticated user.
   * Uses server (anon) client — RLS enforces user_id = auth.uid().
   */
  async findAll(filter?: Partial<AuditEvent>): Promise<AuditEvent[]> {
    const supabase = createServerSupabaseClient();
    let query = supabase.from('audit_events').select('*');

    if (filter) {
      if (filter.userId !== undefined) query = query.eq('user_id', filter.userId);
      if (filter.eventType !== undefined) query = query.eq('event_type', filter.eventType);
      if (filter.requestId !== undefined) query = query.eq('request_id', filter.requestId);
      if (filter.actor !== undefined) query = query.eq('actor', filter.actor);
    }

    const { data, error } = await query.order('timestamp', { ascending: false });
    if (error) {
      throw new Error(`SupabaseAuditLogger.findAll: ${error.message}`);
    }
    return (data ?? []).map((row) => rowToEntity(row as Record<string, unknown>));
  }
}
