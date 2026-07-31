import type { CheckInSession } from '@/domain/repositories/types';
import { createServerSupabaseClient } from '../supabase-client';
import { toSnakeCase, toCamelCase } from '../supabase-repository';

/**
 * Narrow Supabase adapter for check_in_sessions.
 *
 * Operations: findById, findAll, create, update
 * No delete — deletion goes through the privacy API.
 */

/**
 * Convert a row from the database (snake_case + raw dates) to a CheckInSession domain entity.
 */
function rowToEntity(row: Record<string, unknown>): CheckInSession {
  const camel = toCamelCase(row) as Record<string, unknown>;
  return {
    id: camel.id as string,
    userId: camel.userId as string,
    mode: camel.mode as CheckInSession['mode'],
    language: camel.language as CheckInSession['language'],
    status: camel.status as string,
    modelVersion: camel.modelVersion as string,
    promptVersion: camel.promptVersion as string,
    startedAt: new Date(camel.startedAt as string),
    completedAt: camel.completedAt ? new Date(camel.completedAt as string) : undefined,
    structuredSummary: camel.structuredSummary as CheckInSession['structuredSummary'],
  };
}

/**
 * Convert a CheckInSession domain entity to a snake_case DB row.
 */
function entityToRow(entity: Partial<CheckInSession> & Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const snake = toSnakeCase(entity as Record<string, unknown>);
  for (const [key, value] of Object.entries(snake)) {
    // Convert Date objects to ISO strings for Postgres TIMESTAMPTZ
    if (value instanceof Date) {
      row[key] = value.toISOString();
    } else {
      row[key] = value;
    }
  }
  return row;
}

export class SupabaseSessionRepository {
  async findById(id: string): Promise<CheckInSession | null> {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('check_in_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      throw new Error(`SupabaseSessionRepository.findById: ${error.message}`);
    }
    return rowToEntity(data as Record<string, unknown>);
  }

  async findAll(filter?: Partial<CheckInSession>): Promise<CheckInSession[]> {
    const supabase = createServerSupabaseClient();
    let query = supabase.from('check_in_sessions').select('*');

    if (filter) {
      const snakeFilter = toSnakeCase(filter as Record<string, unknown>);
      for (const [key, value] of Object.entries(snakeFilter)) {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      }
    }

    const { data, error } = await query.order('started_at', { ascending: false });
    if (error) {
      throw new Error(`SupabaseSessionRepository.findAll: ${error.message}`);
    }
    return (data ?? []).map((row) => rowToEntity(row as Record<string, unknown>));
  }

  async create(entity: CheckInSession): Promise<CheckInSession> {
    const supabase = createServerSupabaseClient();
    const row = entityToRow(entity as unknown as Record<string, unknown>);

    const { data, error } = await supabase
      .from('check_in_sessions')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      throw new Error(`SupabaseSessionRepository.create: ${error.message}`);
    }
    return rowToEntity(data as Record<string, unknown>);
  }

  async update(id: string, updates: Partial<CheckInSession>): Promise<CheckInSession> {
    const supabase = createServerSupabaseClient();
    const row = entityToRow(updates as Record<string, unknown>);

    // Remove id from updates — it's the key, not a field to update
    delete row.id;

    const { data, error } = await supabase
      .from('check_in_sessions')
      .update(row)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`SupabaseSessionRepository.update: ${error.message}`);
    }
    return rowToEntity(data as Record<string, unknown>);
  }
}
