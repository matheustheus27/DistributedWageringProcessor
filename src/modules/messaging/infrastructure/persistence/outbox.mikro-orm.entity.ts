import { Entity, PrimaryKey, Property, Index } from "@mikro-orm/core";
import { OutboxMessage } from "@modules/messaging/domain/outbox-message";

@Entity({ tableName: "outbox_messages" })
@Index({ name: "idx_outbox_pending_retry", properties: ["publishedAt", "nextAttemptAt"] })
export class OutboxMessageMikroEntity {
  @PrimaryKey({ type: "uuid" })
  id!: string;

  @Property({ type: "string" })
  aggregateId!: string;

  @Property({ type: "string" })
  eventType!: string;

  @Property({ type: "jsonb" })
  payload!: Record<string, unknown>;

  @Property({ type: "datetime" })
  occurredAt!: Date;

  @Property({ type: "integer", default: 0 })
  attempts!: number;

  @Property({ type: "datetime", nullable: true })
  nextAttemptAt?: Date;

  @Property({ type: "datetime", nullable: true })
  publishedAt?: Date;

  public static fromDomain(msg: OutboxMessage): OutboxMessageMikroEntity {
    const entity = new OutboxMessageMikroEntity();
    entity.id = msg.id;
    entity.aggregateId = msg.aggregateId;
    entity.eventType = msg.eventType;
    entity.payload = msg.payload as Record<string, unknown>;
    entity.occurredAt = msg.occurredAt;
    entity.attempts = msg.attempts;
    entity.nextAttemptAt = msg.nextAttemptAt;
    entity.publishedAt = msg.publishedAt;
    return entity;
  }

  public toDomain(): OutboxMessage {
    return OutboxMessage.rehydrate({
      id: this.id,
      aggregateId: this.aggregateId,
      eventType: this.eventType,
      payload: this.payload,
      occurredAt: this.occurredAt,
      attempts: this.attempts,
      nextAttemptAt: this.nextAttemptAt,
      publishedAt: this.publishedAt,
    });
  }
}
