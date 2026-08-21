import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { InboxMessage } from "@modules/messaging/domain/inbox-message";

@Entity({ tableName: "inbox_messages" })
export class InboxMessageMikroEntity {
  @PrimaryKey({ type: "string" })
  consumerName!: string;

  @PrimaryKey({ type: "string" })
  messageId!: string;

  @Property({ type: "string" })
  payloadHash!: string;

  @Property({ type: "datetime" })
  receivedAt!: Date;

  @Property({ type: "datetime", nullable: true })
  processedAt?: Date;

  public static fromDomain(msg: InboxMessage): InboxMessageMikroEntity {
    const entity = new InboxMessageMikroEntity();
    entity.consumerName = msg.consumerName;
    entity.messageId = msg.messageId;
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
