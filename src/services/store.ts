import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { Logger } from '../lib/logger';

export interface AuditEntry {
  at: string;
  recordingId: string;
  handler: string;
  dedupeKey: string;
  summary: string;
  result: 'created' | 'skipped' | 'error';
  detail?: string;
}

interface StoreData {
  /** dedupeKey -> ISO timestamp it was first processed. */
  processed: Record<string, string>;
  /** Bounded, newest-last audit trail. */
  audit: AuditEntry[];
}

const MAX_AUDIT = 1000;

/**
 * A tiny, dependency-free persistent store: idempotency keys so at-least-once
 * webhook redelivery never double-books, plus a bounded audit log. Backed by a
 * single JSON file with atomic writes. Writes are serialized through a promise
 * chain so concurrent handler runs can't clobber each other's file.
 */
export class Store {
  private data: StoreData = { processed: {}, audit: [] };
  private writeChain: Promise<void> = Promise.resolve();
  private loaded = false;

  constructor(
    private readonly filePath: string,
    private readonly logger: Logger,
  ) {}

  async init(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoreData>;
      this.data = { processed: parsed.processed ?? {}, audit: parsed.audit ?? [] };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn({ err }, 'Failed to read store file; starting empty');
      }
      this.data = { processed: {}, audit: [] };
    }
    this.loaded = true;
  }

  hasProcessed(dedupeKey: string): boolean {
    return dedupeKey in this.data.processed;
  }

  /** Mark a dedupe key processed and append an audit entry, then persist. */
  async record(entry: AuditEntry): Promise<void> {
    if (entry.result === 'created') {
      this.data.processed[entry.dedupeKey] = entry.at;
    }
    this.data.audit.push(entry);
    if (this.data.audit.length > MAX_AUDIT) {
      this.data.audit = this.data.audit.slice(-MAX_AUDIT);
    }
    await this.persist();
  }

  recentAudit(limit = 50): AuditEntry[] {
    return this.data.audit.slice(-limit);
  }

  private persist(): Promise<void> {
    const snapshot = JSON.stringify(this.data, null, 2);
    this.writeChain = this.writeChain.then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.${process.pid}.tmp`;
      await fs.writeFile(tmp, snapshot, 'utf8');
      await fs.rename(tmp, this.filePath);
    });
    return this.writeChain.catch((err) => {
      this.logger.error({ err }, 'Failed to persist store');
    });
  }
}
