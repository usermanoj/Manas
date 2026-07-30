import { AuditEvent } from '../repositories/types';

/**
 * AuditLogger interface — all audit events flow through this.
 */
export interface AuditLogger {
  log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void>;
  findAll(filter?: Partial<AuditEvent>): Promise<AuditEvent[]>;
}

/**
 * InMemoryAuditLogger — P0 implementation backed by an in-memory array.
 * Generates sequential UUIDs and timestamps each event at log time.
 */
export class InMemoryAuditLogger implements AuditLogger {
  private readonly events: AuditEvent[] = [];
  private sequenceCounter = 0;

  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    this.sequenceCounter += 1;
    const fullEvent: AuditEvent = {
      ...event,
      id: `audit-${String(this.sequenceCounter).padStart(6, '0')}`,
      timestamp: new Date(),
    };
    this.events.push(fullEvent);
  }

  async findAll(filter?: Partial<AuditEvent>): Promise<AuditEvent[]> {
    if (filter === undefined || filter === null) {
      return [...this.events];
    }

    const filterEntries = Object.entries(filter as Record<string, unknown>);

    return this.events.filter((event) => {
      const eventRecord = event as unknown as Record<string, unknown>;
      return filterEntries.every(([key, filterValue]) => eventRecord[key] === filterValue);
    });
  }

  /**
   * Return the current count of stored audit events (useful for tests).
   */
  get size(): number {
    return this.events.length;
  }

  /**
   * Clear all stored events (useful for tests).
   */
  clear(): void {
    this.events.length = 0;
    this.sequenceCounter = 0;
  }
}
