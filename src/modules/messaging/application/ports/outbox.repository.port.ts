import { OutboxMessage } from "@modules/messaging/domain/outbox-message";

export interface IOutboxRepository {
  save(message: OutboxMessage): Promise<void>;
  findPending(limit: number): Promise<OutboxMessage[]>;
  markPublished(id: string, publishedAt: Date): Promise<void>;
  scheduleRetry(id: string, attempts: number, nextAttemptAt: Date): Promise<void>;
}

export const IOutboxRepository = Symbol("IOutboxRepository");
