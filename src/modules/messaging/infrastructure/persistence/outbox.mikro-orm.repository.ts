import { Injectable } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { OutboxMessage } from "@modules/messaging/domain/outbox-message";
import { IOutboxRepository } from "@modules/messaging/application/ports/outbox.repository.port";
import { OutboxMessageMikroEntity } from "./outbox.mikro-orm.entity";

@Injectable()
export class OutboxMikroRepository implements IOutboxRepository {
  constructor(private readonly em: EntityManager) {}

  public async save(message: OutboxMessage): Promise<void> {
    const entity = OutboxMessageMikroEntity.fromDomain(message);
    await this.em.persistAndFlush(entity);
  }

  public async findPending(limit: number): Promise<OutboxMessage[]> {
    const knex = this.em.getKnex();
    const now = new Date();

    const rows = await knex("outbox_messages")
      .whereNull("published_at")
      .andWhere(function () {
        this.whereNull("next_attempt_at").orWhere("next_attempt_at", "<=", now);
      })
      .orderBy("occurred_at", "asc")
      .limit(limit)
      .forUpdate()
      .skipLocked();

    return rows.map((row: any) =>
      OutboxMessage.rehydrate({
        id: row.id,
        aggregateId: row.aggregate_id,
        eventType: row.event_type,
        payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
        occurredAt: row.occurred_at,
        attempts: row.attempts,
        nextAttemptAt: row.next_attempt_at,
        publishedAt: row.published_at,
      }),
    );
  }

  public async markPublished(id: string, publishedAt: Date): Promise<void> {
    await this.em.nativeUpdate(
      OutboxMessageMikroEntity,
      { id },
      { publishedAt },
    );
  }

  public async scheduleRetry(id: string, attempts: number, nextAttemptAt: Date): Promise<void> {
    await this.em.nativeUpdate(
      OutboxMessageMikroEntity,
      { id },
      { attempts, nextAttemptAt },
    );
  }
}
