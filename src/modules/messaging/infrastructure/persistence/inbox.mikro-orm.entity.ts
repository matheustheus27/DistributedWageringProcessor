import { Entity, PrimaryKey, Property, Unique } from "@mikro-orm/core";
import { InboxMessage } from "@modules/messaging/domain/inbox-message";

@Entity({ tableName: "inbox_messages" })
@Unique({ name: "unique_inbox_consumer_msg", properties: ["consumerName", "messageId"] })
export class InboxMessageMikroEntity {
  @PrimaryKey({ type: "uuid" })
  id!: string;

  @Property({ type: "string" })
  messageId!: string;

  @Property({ type: "string" })
  consumerName!: string;

  @Property({ type: "string" })
  payloadHash!: string;

  @Property({ type: "datetime" })
  receivedAt!: Date;

  @Property({ type: "datetime", nullable: true })
  processedAt?: Date;

  public static fromDomain(msg: InboxMessage): InboxMessageMikroEntity {
    const entity = new InboxMessageMikroEntity();
    entity.id = crypto.randomUUID();
    entity.messageId = msg.messageId;
    entity.consumerName = msg.consumerName;
    entity.payloadHash = msg.payloadHash;
    entity.receivedAt = msg.receivedAt;
    entity.processedAt = msg.processedAt;
    return entity;
  }

  public toDomain(): InboxMessage {
    return InboxMessage.rehydrate({
      messageId: this.messageId,
      consumerName: this.consumerName,
      payloadHash: this.payloadHash,
      receivedAt: this.receivedAt,
      processedAt: this.processedAt,
    });
  }
}
