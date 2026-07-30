import { Repository } from './types';

/**
 * InMemoryRepository — Map-backed implementation of the Repository interface.
 *
 * All operations are synchronous internally but wrapped in Promise for
 * interface compatibility with the future Supabase adapter.
 */
export class InMemoryRepository<T extends { id: string }> implements Repository<T> {
  private readonly store: Map<string, T> = new Map();

  /**
   * Load demo/seed data into the repository.
   * Replaces any existing entry with the same id.
   */
  seed(data: T[]): void {
    for (const entity of data) {
      this.store.set(entity.id, this.clone(entity));
    }
  }

  async findById(id: string): Promise<T | null> {
    const entity = this.store.get(id);
    return entity !== undefined ? this.clone(entity) : null;
  }

  async findAll(filter?: Partial<T>): Promise<T[]> {
    const allEntities = Array.from(this.store.values());

    if (filter === undefined || filter === null) {
      return allEntities.map((entity) => this.clone(entity));
    }

    const filterEntries = Object.entries(filter as Record<string, unknown>);

    return allEntities
      .filter((entity) => {
        const entityRecord = entity as unknown as Record<string, unknown>;
        return filterEntries.every(([key, filterValue]) => {
          return entityRecord[key] === filterValue;
        });
      })
      .map((entity) => this.clone(entity));
  }

  async create(entity: T): Promise<T> {
    if (this.store.has(entity.id)) {
      throw new Error(`InMemoryRepository: entity with id "${entity.id}" already exists.`);
    }
    const stored = this.clone(entity);
    this.store.set(entity.id, stored);
    return this.clone(stored);
  }

  async update(id: string, updates: Partial<T>): Promise<T> {
    const existing = this.store.get(id);
    if (existing === undefined) {
      throw new Error(`InMemoryRepository: entity with id "${id}" not found.`);
    }
    const updated = { ...existing, ...updates, id } as T;
    this.store.set(id, this.clone(updated));
    return this.clone(updated);
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  /**
   * Return the current count of stored entities (useful for tests).
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Remove all entities from the store (useful for tests).
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Deep-clone an entity to prevent external mutation of internal state.
   * Uses structuredClone when available, falls back to JSON round-trip.
   */
  private clone(entity: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(entity);
    }
    return JSON.parse(JSON.stringify(entity)) as T;
  }
}
