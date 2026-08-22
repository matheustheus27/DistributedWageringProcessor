import { Injectable } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { InboxMessage } from "@modules/messaging/domain/inbox-message";
import { IInboxRepository } from "@modules/messaging/application/ports/inbox.repository.port";
import { InboxMessageMikroEntity } from "./inbox.mikro-orm.entity";

@Injectable()
export class InboxMikroRepository implements IInboxRepository {
  constructor(private readonly em: EntityManager) {}

  public async findByMessageId(consumerName: string, messageId: string): Promise<InboxMessage | null> {
    const entity = await this.em.findOne(InboxMessageMikroEntity, { consumerName, messageId });
    return entity ? entity.toDomain() : null;
  }

  public async save(message: InboxMessage): Promise<void> {
    const entity = InboxMessageMikroEntity.fromDomain(message);
    await this.em.upsert(entity);
  }
}
