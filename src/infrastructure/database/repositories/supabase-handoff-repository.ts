import type { Handoff } from '@/domain/repositories/types';
import { createServerSupabaseClient } from '../supabase-client';
import { toCamelCase } from '../supabase-repository';

/**
 * Narrow Supabase adapter for handoffs.
 *
 * Operations: findById, findAll, create, updateFields, addExcludedEntry, updateStatus
 * No generic update() — HandoffService calls specific methods.
 */

/**
 * Convert a DB row to a Handoff domain entity.
 */
function rowToEntity(row: Record<string, unknown>): Handoff {
  const camel = toCamelCase(row) as Record<string, unknown>;
  return {
    id: camel.id as string,
    userId: camel.userId as string,
    providerId: camel.providerId as string,
    status: camel.status as string,
    structuredSummary: camel.structuredSummary as Handoff['structuredSummary'],
    excludedEntries: (camel.excludedEntries as string[]) ?? [],
    userNote: camel.userNote as string | undefined,
    version: camel.version as number,
    sentAt: camel.sentAt ? new Date(camel.sentAt as string) : undefined,
  };
}

export class SupabaseHandoffRepository {
  async findById(id: string): Promise<Handoff | null> {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('handoffs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      throw new Error(`SupabaseHandoffRepository.findById: ${error.message}`);
    }
    return rowToEntity(data as Record<string, unknown>);
  }

  async findAll(filter?: Partial<Handoff>): Promise<Handoff[]> {
    const supabase = createServerSupabaseClient();
    let query = supabase.from('handoffs').select('*');

    if (filter) {
      // Only apply simple equality filters for known columns
      const filterMap: Record<string, unknown> = {};
      if (filter.userId !== undefined) filterMap.user_id = filter.userId;
      if (filter.providerId !== undefined) filterMap.provider_id = filter.providerId;
      if (filter.status !== undefined) filterMap.status = filter.status;

      for (const [key, value] of Object.entries(filterMap)) {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      throw new Error(`SupabaseHandoffRepository.findAll: ${error.message}`);
    }
    return (data ?? []).map((row) => rowToEntity(row as Record<string, unknown>));
  }

  async create(entity: Handoff): Promise<Handoff> {
    const supabase = createServerSupabaseClient();
    const row: Record<string, unknown> = {
      id: entity.id,
      user_id: entity.userId,
      provider_id: entity.providerId,
      status: entity.status,
      structured_summary: entity.structuredSummary,
      excluded_entries: entity.excludedEntries,
      user_note: entity.userNote ?? null,
      version: entity.version,
    };

    const { data, error } = await supabase
      .from('handoffs')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      throw new Error(`SupabaseHandoffRepository.create: ${error.message}`);
    }
    return rowToEntity(data as Record<string, unknown>);
  }

  /**
   * Update editable fields: structured_summary, excluded_entries, user_note.
   * Bumps updated_at automatically.
   */
  async updateFields(
    id: string,
    updates: { structuredSummary?: Handoff['structuredSummary']; excludedEntries?: string[]; userNote?: string }
  ): Promise<Handoff> {
    const supabase = createServerSupabaseClient();
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (updates.structuredSummary !== undefined) {
      row.structured_summary = updates.structuredSummary;
    }
    if (updates.excludedEntries !== undefined) {
      row.excluded_entries = updates.excludedEntries;
    }
    if (updates.userNote !== undefined) {
      row.user_note = updates.userNote;
    }

    const { data, error } = await supabase
      .from('handoffs')
      .update(row)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`SupabaseHandoffRepository.updateFields: ${error.message}`);
    }
    return rowToEntity(data as Record<string, unknown>);
  }

  /**
   * Atomically append an entry to excluded_entries using Postgres array concatenation.
   */
  async addExcludedEntry(id: string, entry: string): Promise<Handoff> {
    const supabase = createServerSupabaseClient();

    // Fetch current excluded_entries, append, then update
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`SupabaseHandoffRepository.addExcludedEntry: Handoff "${id}" not found.`);
    }

    const updatedEntries = [...existing.excludedEntries, entry];
    const { data, error } = await supabase
      .from('handoffs')
      .update({
        excluded_entries: updatedEntries,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`SupabaseHandoffRepository.addExcludedEntry: ${error.message}`);
    }
    return rowToEntity(data as Record<string, unknown>);
  }

  /**
   * Atomic status + version update. Uses optimistic concurrency:
   * the update only succeeds if the current version matches.
   */
  async updateStatus(id: string, newStatus: string, version: number): Promise<Handoff> {
    const supabase = createServerSupabaseClient();
    const now = new Date().toISOString();

    const updateRow: Record<string, unknown> = {
      status: newStatus,
      version,
      updated_at: now,
    };

    // If transitioning to SENT, set sent_at
    if (newStatus === 'SENT') {
      updateRow.sent_at = now;
    }

    const { data, error } = await supabase
      .from('handoffs')
      .update(updateRow)
      .eq('id', id)
      .eq('version', version - 1) // optimistic lock: version must be previous
      .select('*')
      .single();

    if (error) {
      throw new Error(`SupabaseHandoffRepository.updateStatus: ${error.message}`);
    }
    if (!data) {
      throw new Error(
        `SupabaseHandoffRepository.updateStatus: Optimistic lock failed — handoff "${id}" version conflict.`
      );
    }
    return rowToEntity(data as Record<string, unknown>);
  }
}
