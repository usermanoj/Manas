import type { AuditLogger } from '@/domain/audit';
import type { Repository } from '@/domain/repositories';

/**
 * Operation types supported by the unit of work.
 */
export interface CreateOperation {
  type: 'create';
  repo: Repository<{ id: string }>;
  entity: { id: string };
}

export interface UpdateOperation {
  type: 'update';
  repo: Repository<{ id: string }>;
  id: string;
  updates: Record<string, unknown>;
}

export interface AuditOperation {
  type: 'audit';
  auditLogger: AuditLogger;
  event: Parameters<AuditLogger['log']>[0];
}

export type UnitOfWorkOperation = CreateOperation | UpdateOperation | AuditOperation;

/**
 * InMemoryUnitOfWork — batches create/update/audit operations and applies them
 * atomically on commit(). Supports failAt() for testing rollback scenarios.
 */
export class InMemoryUnitOfWork {
  private operations: UnitOfWorkOperation[] = [];
  private failureIndex: number | null = null;

  prepare(operation: UnitOfWorkOperation): void {
    this.operations.push(operation);
  }

  /**
   * For testing: inject a forced failure at the given stage index during commit.
   * When commit reaches that index, it throws BEFORE executing that stage.
   */
  failAt(stageIndex: number): void {
    this.failureIndex = stageIndex;
  }

  async commit(): Promise<void> {
    for (let i = 0; i < this.operations.length; i++) {
      if (this.failureIndex !== null && i === this.failureIndex) {
        throw new Error(`Forced failure at stage ${i}`);
      }

      const op = this.operations[i];
      if (op.type === 'create') {
        await op.repo.create(op.entity);
      } else if (op.type === 'update') {
        await op.repo.update(op.id, op.updates as never);
      } else if (op.type === 'audit') {
        await op.auditLogger.log(op.event);
      }
    }
    this.operations = [];
    this.failureIndex = null;
  }

  async rollback(): Promise<void> {
    this.operations = [];
    this.failureIndex = null;
  }
}
