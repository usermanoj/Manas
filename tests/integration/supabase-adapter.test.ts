import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CheckInSession, Provider, Handoff, AuditEvent } from '@/domain/repositories/types';
import type { StructuredCheckIn } from '@/domain/ai';

// ---------------------------------------------------------------------------
// Mock server-only (imported by supabase-client.ts and supabase-audit-logger.ts)
// ---------------------------------------------------------------------------
vi.mock('server-only', () => ({}));

// ---------------------------------------------------------------------------
// Mock Supabase client factory
// ---------------------------------------------------------------------------

interface MockState {
  fromTable: string | null;
  fromCalls: string[];
  insertedRows: Record<string, unknown>[];
  updatedRows: Record<string, unknown>[];
  eqArgs: Array<{ column: string; value: unknown }>;
  orderArg: { column: string; opts?: { ascending?: boolean } } | null;
}

function createMockSupabaseClient(opts: {
  singleData?: unknown;
  listData?: unknown[];
  onState?: (state: MockState) => void;
} = {}) {
  const { singleData = null, listData = [], onState } = opts;

  const state: MockState = {
    fromTable: null,
    fromCalls: [],
    insertedRows: [],
    updatedRows: [],
    eqArgs: [],
    orderArg: null,
  };

  function snapshot() {
    if (onState) onState(state);
  }

  const qb: Record<string, unknown> = {};
  // Chainable methods — return qb
  for (const m of ['select', 'eq', 'order', 'limit', 'range']) {
    qb[m] = vi.fn((...args: unknown[]) => {
      if (m === 'eq') {
        state.eqArgs.push({ column: args[0] as string, value: args[1] });
      }
      if (m === 'order') {
        state.orderArg = { column: args[0] as string, opts: args[1] as { ascending?: boolean } };
      }
      snapshot();
      return qb;
    });
  }
  // insert / update — track payload, return qb for chaining
  qb.insert = vi.fn((row: Record<string, unknown>) => {
    state.insertedRows.push(row);
    snapshot();
    return qb;
  });
  qb.update = vi.fn((row: Record<string, unknown>) => {
    state.updatedRows.push(row);
    snapshot();
    return qb;
  });
  // Terminal: single() returns a Promise
  qb.single = vi.fn().mockResolvedValue({ data: singleData, error: null });
  // Make the query-builder itself awaitable (for findAll which awaits the chain directly)
  qb.then = vi.fn((resolve: (v: unknown) => void) =>
    Promise.resolve({ data: listData, error: null }).then(resolve),
  );

  const client = {
    from: vi.fn((table: string) => {
      state.fromTable = table;
      state.fromCalls.push(table);
      snapshot();
      return qb;
    }),
  };

  return { client, qb, state };
}

// Shared references — set in beforeEach
let serverClient: ReturnType<typeof createMockSupabaseClient>;
let adminClient: ReturnType<typeof createMockSupabaseClient>;

vi.mock('@/infrastructure/database/supabase-client', () => ({
  createServerSupabaseClient: () => serverClient.client,
  createAdminSupabaseClient: () => adminClient.client,
}));

// ---------------------------------------------------------------------------
// Import adapters AFTER vi.mock() hoisting
// ---------------------------------------------------------------------------
import { toSnakeCase, toCamelCase } from '@/infrastructure/database/supabase-repository';
import { SupabaseSessionRepository } from '@/infrastructure/database/repositories/supabase-session-repository';
import { SupabaseProviderRepository } from '@/infrastructure/database/repositories/supabase-provider-repository';
import { SupabaseHandoffRepository } from '@/infrastructure/database/repositories/supabase-handoff-repository';
import { SupabaseAuditLogger } from '@/infrastructure/database/supabase-audit-logger';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SESSION_ROW: Record<string, unknown> = {
  id: 's1',
  user_id: 'u1',
  mode: 'GUEST',
  language: 'en',
  status: 'COMPLETED',
  model_version: 'mock-v1',
  prompt_version: 'prompt-v1',
  started_at: '2026-01-01T00:00:00.000Z',
  completed_at: '2026-01-01T01:00:00.000Z',
  structured_summary: { primary_concern: 'stress' },
};

const PROVIDER_ROW: Record<string, unknown> = {
  id: 'p1',
  profile_id: 'prof1',
  name: 'Dr. Demo',
  title: 'Psychologist',
  languages: ['en'],
  focus_areas: ['anxiety'],
  availability: 'weekdays',
  session_type: 'video',
  price_range: '$$',
  bio: 'Demo bio',
  is_fictional_demo: true,
};

const HANDOFF_ROW: Record<string, unknown> = {
  id: 'h1',
  user_id: 'u1',
  provider_id: 'p1',
  status: 'DRAFT',
  structured_summary: { primary_concern: 'stress' },
  excluded_entries: [],
  user_note: null,
  version: 1,
  sent_at: null,
};

const AUDIT_ROW: Record<string, unknown> = {
  id: 'a1',
  timestamp: '2026-01-01T00:00:00.000Z',
  request_id: 'req1',
  user_id: 'u1',
  actor: 'system',
  event_type: 'CHECK_IN_STARTED',
  details: {},
  policy_version: 'safety-v1',
  model_version: 'mock-v1',
  prompt_version: 'prompt-v1',
};

// ---------------------------------------------------------------------------
// 1. Case-conversion utilities
// ---------------------------------------------------------------------------

describe('toSnakeCase / toCamelCase', () => {
  it('converts camelCase keys to snake_case', () => {
    expect(toSnakeCase({ primaryConcern: 'test' })).toEqual({ primary_concern: 'test' });
  });

  it('converts multiple camelCase keys', () => {
    expect(toSnakeCase({ userId: 'u1', modelVersion: 'v1' })).toEqual({
      user_id: 'u1',
      model_version: 'v1',
    });
  });

  it('converts snake_case keys to camelCase', () => {
    expect(toCamelCase({ primary_concern: 'test' })).toEqual({ primaryConcern: 'test' });
  });

  it('converts multiple snake_case keys', () => {
    expect(toCamelCase({ user_id: 'u1', model_version: 'v1' })).toEqual({
      userId: 'u1',
      modelVersion: 'v1',
    });
  });

  it('handles arrays of objects (toSnakeCase)', () => {
    const input = [{ primaryConcern: 'a' }, { userId: 'b' }];
    const result = toSnakeCase(input);
    expect(result).toEqual([{ primary_concern: 'a' }, { user_id: 'b' }]);
  });

  it('handles arrays of objects (toCamelCase)', () => {
    const input = [{ primary_concern: 'a' }, { user_id: 'b' }];
    const result = toCamelCase(input);
    expect(result).toEqual([{ primaryConcern: 'a' }, { userId: 'b' }]);
  });

  it('returns an empty object unchanged (toSnakeCase)', () => {
    expect(toSnakeCase({})).toEqual({});
  });

  it('returns an empty object unchanged (toCamelCase)', () => {
    expect(toCamelCase({})).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 2. Session repository adapter
// ---------------------------------------------------------------------------

describe('SupabaseSessionRepository', () => {
  let repo: SupabaseSessionRepository;

  beforeEach(() => {
    serverClient = createMockSupabaseClient({
      singleData: SESSION_ROW,
      listData: [SESSION_ROW],
    });
    adminClient = createMockSupabaseClient();
    repo = new SupabaseSessionRepository();
  });

  it('findById queries check_in_sessions with correct filter', async () => {
    const result = await repo.findById('s1');

    expect(serverClient.client.from).toHaveBeenCalledWith('check_in_sessions');
    expect(serverClient.qb.select).toHaveBeenCalledWith('*');
    expect(serverClient.qb.eq).toHaveBeenCalledWith('id', 's1');
    expect(serverClient.qb.single).toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result!.id).toBe('s1');
    expect(result!.userId).toBe('u1');
    expect(result!.modelVersion).toBe('mock-v1');
  });

  it('findAll without filter returns ordered results', async () => {
    const results = await repo.findAll();

    expect(serverClient.client.from).toHaveBeenCalledWith('check_in_sessions');
    expect(serverClient.qb.select).toHaveBeenCalledWith('*');
    expect(serverClient.qb.order).toHaveBeenCalledWith('started_at', { ascending: false });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('s1');
  });

  it('findAll with filter applies snake_case eq filters', async () => {
    await repo.findAll({ userId: 'u1', status: 'COMPLETED' });

    expect(serverClient.qb.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(serverClient.qb.eq).toHaveBeenCalledWith('status', 'COMPLETED');
  });

  it('create converts camelCase entity to snake_case row before insert', async () => {
    const entity: CheckInSession = {
      id: 's2',
      userId: 'u2',
      mode: 'GUEST',
      language: 'en',
      status: 'INITIATED',
      modelVersion: 'v1',
      promptVersion: 'p1',
      startedAt: new Date('2026-06-01T00:00:00Z'),
      structuredSummary: { primary_concern: 'test' } as unknown as StructuredCheckIn,
    };

    await repo.create(entity);

    expect(serverClient.client.from).toHaveBeenCalledWith('check_in_sessions');
    expect(serverClient.qb.insert).toHaveBeenCalled();

    const insertedRow = serverClient.state.insertedRows[0];
    expect(insertedRow).toHaveProperty('user_id', 'u2');
    expect(insertedRow).toHaveProperty('model_version', 'v1');
    expect(insertedRow).toHaveProperty('prompt_version', 'p1');
    expect(insertedRow).toHaveProperty('started_at');
    // Should NOT have camelCase keys
    expect(insertedRow).not.toHaveProperty('userId');
    expect(insertedRow).not.toHaveProperty('modelVersion');
  });

  it('update converts partial entity and strips id from update payload', async () => {
    await repo.update('s1', { status: 'SUMMARIZED' });

    expect(serverClient.client.from).toHaveBeenCalledWith('check_in_sessions');
    expect(serverClient.qb.update).toHaveBeenCalled();
    expect(serverClient.qb.eq).toHaveBeenCalledWith('id', 's1');

    const updatedRow = serverClient.state.updatedRows[0];
    expect(updatedRow).toHaveProperty('status', 'SUMMARIZED');
    // id must be stripped
    expect(updatedRow).not.toHaveProperty('id');
  });

  it('does NOT expose a delete method', () => {
    expect((repo as unknown as Record<string, unknown>).delete).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. Provider repository adapter (read-only)
// ---------------------------------------------------------------------------

describe('SupabaseProviderRepository', () => {
  let repo: SupabaseProviderRepository;

  beforeEach(() => {
    serverClient = createMockSupabaseClient({
      singleData: PROVIDER_ROW,
      listData: [PROVIDER_ROW],
    });
    adminClient = createMockSupabaseClient();
    repo = new SupabaseProviderRepository();
  });

  it('findById queries providers table', async () => {
    const result = await repo.findById('p1');

    expect(serverClient.client.from).toHaveBeenCalledWith('providers');
    expect(serverClient.qb.select).toHaveBeenCalledWith('*');
    expect(serverClient.qb.eq).toHaveBeenCalledWith('id', 'p1');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Dr. Demo');
    expect(result!.isFictionalDemo).toBe(true);
  });

  it('findAll returns providers ordered by name', async () => {
    const results = await repo.findAll();

    expect(serverClient.client.from).toHaveBeenCalledWith('providers');
    expect(serverClient.qb.order).toHaveBeenCalledWith('name', { ascending: true });
    expect(results).toHaveLength(1);
  });

  it('findAll with filter applies snake_case eq', async () => {
    await repo.findAll({ isFictionalDemo: true });

    expect(serverClient.qb.eq).toHaveBeenCalledWith('is_fictional_demo', true);
  });

  it('is read-only: no create, update, or delete methods', () => {
    const r = repo as unknown as Record<string, unknown>;
    expect(r.create).toBeUndefined();
    expect(r.update).toBeUndefined();
    expect(r.delete).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Handoff repository adapter
// ---------------------------------------------------------------------------

describe('SupabaseHandoffRepository', () => {
  let repo: SupabaseHandoffRepository;

  beforeEach(() => {
    serverClient = createMockSupabaseClient({
      singleData: HANDOFF_ROW,
      listData: [HANDOFF_ROW],
    });
    adminClient = createMockSupabaseClient();
    repo = new SupabaseHandoffRepository();
  });

  it('findById queries handoffs table', async () => {
    const result = await repo.findById('h1');

    expect(serverClient.client.from).toHaveBeenCalledWith('handoffs');
    expect(serverClient.qb.eq).toHaveBeenCalledWith('id', 'h1');
    expect(result).not.toBeNull();
    expect(result!.userId).toBe('u1');
    expect(result!.providerId).toBe('p1');
    expect(result!.version).toBe(1);
  });

  it('findAll without filter returns ordered results', async () => {
    const results = await repo.findAll();

    expect(serverClient.client.from).toHaveBeenCalledWith('handoffs');
    expect(serverClient.qb.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(results).toHaveLength(1);
  });

  it('findAll with filter maps camelCase to snake_case columns', async () => {
    await repo.findAll({ userId: 'u1', status: 'DRAFT' });

    expect(serverClient.qb.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(serverClient.qb.eq).toHaveBeenCalledWith('status', 'DRAFT');
  });

  it('create inserts a snake_case row', async () => {
    const entity: Handoff = {
      id: 'h2',
      userId: 'u2',
      providerId: 'p2',
      status: 'DRAFT',
      structuredSummary: { primary_concern: 'x' } as unknown as StructuredCheckIn,
      excludedEntries: [],
      version: 1,
    };

    await repo.create(entity);

    expect(serverClient.client.from).toHaveBeenCalledWith('handoffs');
    const row = serverClient.state.insertedRows[0];
    expect(row).toHaveProperty('user_id', 'u2');
    expect(row).toHaveProperty('provider_id', 'p2');
    expect(row).toHaveProperty('structured_summary');
    expect(row).toHaveProperty('excluded_entries');
    expect(row).toHaveProperty('version', 1);
  });

  it('updateFields updates only allowed fields', async () => {
    await repo.updateFields('h1', { userNote: 'my note' });

    expect(serverClient.qb.update).toHaveBeenCalled();
    const row = serverClient.state.updatedRows[0];
    expect(row).toHaveProperty('user_note', 'my note');
    expect(row).toHaveProperty('updated_at');
    // Should not contain unrelated fields
    expect(row).not.toHaveProperty('status');
    expect(row).not.toHaveProperty('version');
  });

  it('addExcludedEntry fetches current, appends, and updates', async () => {
    // findById returns the existing handoff, then update is called with appended list
    await repo.addExcludedEntry('h1', 'sensitive_topic');

    // First call: findById (select chain)
    // Second call: update chain
    expect(serverClient.client.from).toHaveBeenCalledWith('handoffs');
    const row = serverClient.state.updatedRows[0];
    expect(row).toHaveProperty('excluded_entries');
    expect(row.excluded_entries).toContain('sensitive_topic');
    expect(row).toHaveProperty('updated_at');
  });

  it('updateStatus includes optimistic concurrency check (version - 1)', async () => {
    await repo.updateStatus('h1', 'SENT', 2);

    expect(serverClient.qb.update).toHaveBeenCalled();
    const row = serverClient.state.updatedRows[0];
    expect(row).toHaveProperty('status', 'SENT');
    expect(row).toHaveProperty('version', 2);
    expect(row).toHaveProperty('sent_at'); // SENT sets sent_at

    // Optimistic lock: eq('version', version - 1)
    expect(serverClient.qb.eq).toHaveBeenCalledWith('version', 1);
  });

  it('updateStatus for non-SENT status does not set sent_at', async () => {
    await repo.updateStatus('h1', 'ACCEPTED', 2);

    const row = serverClient.state.updatedRows[0];
    expect(row).toHaveProperty('status', 'ACCEPTED');
    expect(row).not.toHaveProperty('sent_at');
  });

  it('does NOT expose a generic update method', () => {
    expect((repo as unknown as Record<string, unknown>).update).toBeUndefined();
  });

  it('does NOT expose a delete method', () => {
    expect((repo as unknown as Record<string, unknown>).delete).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Audit logger adapter
// ---------------------------------------------------------------------------

describe('SupabaseAuditLogger', () => {
  let logger: SupabaseAuditLogger;

  beforeEach(() => {
    serverClient = createMockSupabaseClient({ listData: [AUDIT_ROW] });
    adminClient = createMockSupabaseClient();
    logger = new SupabaseAuditLogger();
  });

  it('log() inserts into audit_events via admin client with correct mapping', async () => {
    await logger.log({
      requestId: 'req1',
      userId: 'u1',
      actor: 'system',
      eventType: 'CHECK_IN_STARTED',
      details: { step: 'primary_concern' },
      policyVersion: 'safety-v1',
      modelVersion: 'mock-v1',
      promptVersion: 'prompt-v1',
    });

    expect(adminClient.client.from).toHaveBeenCalledWith('audit_events');
    expect(adminClient.qb.insert).toHaveBeenCalled();

    const row = adminClient.state.insertedRows[0];
    expect(row).toHaveProperty('request_id', 'req1');
    expect(row).toHaveProperty('user_id', 'u1');
    expect(row).toHaveProperty('actor', 'system');
    expect(row).toHaveProperty('event_type', 'CHECK_IN_STARTED');
    expect(row).toHaveProperty('details', { step: 'primary_concern' });
    expect(row).toHaveProperty('policy_version', 'safety-v1');
    expect(row).toHaveProperty('model_version', 'mock-v1');
    expect(row).toHaveProperty('prompt_version', 'prompt-v1');
  });

  it('log() does not throw on insert error (graceful degradation)', async () => {
    // Override the admin mock to return an error
    const errorClient = createMockSupabaseClient();
    errorClient.qb.insert = vi.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } });
    adminClient = errorClient;

    // Should not throw
    await expect(
      logger.log({
        requestId: 'req1',
        userId: 'u1',
        actor: 'system',
        eventType: 'TEST',
        details: {},
      }),
    ).resolves.toBeUndefined();
  });

  it('findAll() scopes to user via eq filter', async () => {
    const results = await logger.findAll({ userId: 'u1' });

    expect(serverClient.client.from).toHaveBeenCalledWith('audit_events');
    expect(serverClient.qb.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(serverClient.qb.order).toHaveBeenCalledWith('timestamp', { ascending: false });
    expect(results).toHaveLength(1);
    expect(results[0].userId).toBe('u1');
    expect(results[0].eventType).toBe('CHECK_IN_STARTED');
  });

  it('findAll() applies multiple filters', async () => {
    await logger.findAll({ userId: 'u1', eventType: 'CHECK_IN_STARTED', actor: 'system' });

    expect(serverClient.qb.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(serverClient.qb.eq).toHaveBeenCalledWith('event_type', 'CHECK_IN_STARTED');
    expect(serverClient.qb.eq).toHaveBeenCalledWith('actor', 'system');
  });

  it('does NOT expose update or delete methods', () => {
    const r = logger as unknown as Record<string, unknown>;
    expect(r.update).toBeUndefined();
    expect(r.delete).toBeUndefined();
  });
});
