import { Injectable } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import {
  WagerTransaction,
  WagerTransactionStatus,
} from "@modules/wagering/domain/wager-transaction";
import { IWagerTransactionRepository } from "@modules/wagering/application/ports/wager-transaction.repository.port";
import { WagerTransactionMikroEntity } from "./wager-transaction.mikro-orm.entity";

@Injectable()
export class WagerTransactionMikroRepository implements IWagerTransactionRepository {
  constructor(private readonly em: EntityManager) {}

  public async findById(id: string): Promise<WagerTransaction | null> {
    const entity = await this.em.findOne(WagerTransactionMikroEntity, { id });
    return entity ? entity.toDomain() : null;
  }

  public async findByProviderAndExternalId(
    providerId: string,
    externalTransactionId: string,
  ): Promise<WagerTransaction | null> {
    const entity = await this.em.findOne(WagerTransactionMikroEntity, {
      providerId,
      externalTransactionId,
    });
    return entity ? entity.toDomain() : null;
  }

  public async findByIdempotencyKey(idempotencyKey: string): Promise<WagerTransaction | null> {
    const entity = await this.em.findOne(WagerTransactionMikroEntity, { idempotencyKey });
    return entity ? entity.toDomain() : null;
  }

  public async findPendingReferences(limit: number): Promise<WagerTransaction[]> {
    const entities = await this.em.find(
      WagerTransactionMikroEntity,
      { status: WagerTransactionStatus.PendingReference },
      { limit, orderBy: { createdAt: "ASC" } },
    );
    return entities.map((e) => e.toDomain());
  }

  public async save(transaction: WagerTransaction): Promise<void> {
    const entity = WagerTransactionMikroEntity.fromDomain(transaction);
    await this.em.upsert(entity);
  }
}
