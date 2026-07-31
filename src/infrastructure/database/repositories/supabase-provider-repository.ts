import type { Provider } from '@/domain/repositories/types';
import { createServerSupabaseClient } from '../supabase-client';
import { toSnakeCase, toCamelCase } from '../supabase-repository';

/**
 * Read-only Supabase adapter for providers.
 *
 * Operations: findById, findAll
 * No create, update, delete — providers are seeded via admin script.
 */

/**
 * Convert a DB row to a Provider domain entity.
 */
function rowToEntity(row: Record<string, unknown>): Provider {
  const camel = toCamelCase(row) as Record<string, unknown>;
  return {
    id: camel.id as string,
    // profile_id is nullable in DB — default null to empty string for TS type
    profileId: (camel.profileId as string) ?? '',
    name: camel.name as string,
    title: camel.title as string,
    languages: (camel.languages as string[]) ?? [],
    focusAreas: (camel.focusAreas as string[]) ?? [],
    availability: camel.availability as string,
    sessionType: camel.sessionType as string,
    priceRange: camel.priceRange as string,
    bio: camel.bio as string,
    isFictionalDemo: camel.isFictionalDemo as boolean,
  };
}

export class SupabaseProviderRepository {
  async findById(id: string): Promise<Provider | null> {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('providers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      throw new Error(`SupabaseProviderRepository.findById: ${error.message}`);
    }
    return rowToEntity(data as Record<string, unknown>);
  }

  async findAll(filter?: Partial<Provider>): Promise<Provider[]> {
    const supabase = createServerSupabaseClient();
    let query = supabase.from('providers').select('*');

    if (filter) {
      const snakeFilter = toSnakeCase(filter as Record<string, unknown>);
      for (const [key, value] of Object.entries(snakeFilter)) {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      }
    }

    const { data, error } = await query.order('name', { ascending: true });
    if (error) {
      throw new Error(`SupabaseProviderRepository.findAll: ${error.message}`);
    }
    return (data ?? []).map((row) => rowToEntity(row as Record<string, unknown>));
  }
}
