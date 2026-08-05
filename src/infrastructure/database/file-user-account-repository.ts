import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { InMemoryRepository } from '@/domain/repositories';
import type { UserAccount } from '@/domain/repositories';

/**
 * FileBackedUserAccountRepository
 *
 * The prototype runs on in-memory repositories, which means accounts created
 * at runtime (real visitors registering during a demo) vanish whenever the
 * dev server restarts. This subclass keeps the in-memory behaviour but
 * additionally persists runtime-registered accounts to a local, gitignored
 * JSON file and rehydrates them on startup — so demo accounts survive
 * restarts without introducing a real database.
 *
 * Seeded demo accounts are never written to the file; they always come from
 * seed data. Persistence is disabled under `NODE_ENV=test` so test suites
 * never touch the local data file.
 */
const DATA_DIR = path.join(process.cwd(), '.data');
const FILE_PATH = path.join(DATA_DIR, 'user-accounts.json');

/** Serialised form — Dates become ISO strings on disk. */
type StoredUserAccount = Omit<UserAccount, 'createdAt'> & { createdAt: string };

export class FileBackedUserAccountRepository extends InMemoryRepository<UserAccount> {
  private readonly seedIds: Set<string>;

  constructor(seedAccounts: UserAccount[]) {
    super();
    this.seed(seedAccounts);
    this.seedIds = new Set(seedAccounts.map((a) => a.id));
    this.loadFromDisk();
  }

  private get persistenceEnabled(): boolean {
    return process.env.NODE_ENV !== 'test';
  }

  private loadFromDisk(): void {
    if (!this.persistenceEnabled) return;
    try {
      if (!existsSync(FILE_PATH)) return;
      const raw = JSON.parse(readFileSync(FILE_PATH, 'utf8')) as StoredUserAccount[];
      for (const entry of raw) {
        if (this.seedIds.has(entry.id)) continue;
        this.seed([{ ...entry, createdAt: new Date(entry.createdAt) }]);
      }
    } catch {
      // Corrupt or unreadable file — start fresh rather than break auth.
    }
  }

  private async persistToDisk(): Promise<void> {
    if (!this.persistenceEnabled) return;
    try {
      const all = await this.findAll();
      const runtimeAccounts = all.filter((a) => !this.seedIds.has(a.id));
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(FILE_PATH, JSON.stringify(runtimeAccounts, null, 2), 'utf8');
    } catch {
      // Best-effort persistence — never break the auth flow on I/O errors.
    }
  }

  override async create(entity: UserAccount): Promise<UserAccount> {
    const created = await super.create(entity);
    await this.persistToDisk();
    return created;
  }

  override async update(id: string, updates: Partial<UserAccount>): Promise<UserAccount> {
    const updated = await super.update(id, updates);
    await this.persistToDisk();
    return updated;
  }

  override async delete(id: string): Promise<boolean> {
    const deleted = await super.delete(id);
    if (deleted) {
      await this.persistToDisk();
    }
    return deleted;
  }
}
