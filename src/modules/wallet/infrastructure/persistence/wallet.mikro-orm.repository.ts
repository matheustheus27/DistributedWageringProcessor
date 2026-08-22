import { Injectable } from "@nestjs/common";
import { EntityManager, LockMode } from "@mikro-orm/postgresql";
import { Wallet } from "@modules/wallet/domain/wallet";
import { IWalletRepository } from "@modules/wallet/application/ports/wallet.repository.port";
import { WalletMikroEntity } from "./wallet.mikro-orm.entity";

@Injectable()
export class WalletMikroRepository implements IWalletRepository {
  constructor(private readonly em: EntityManager) {}

  public async findById(id: string, lock: boolean = false): Promise<Wallet | null> {
    if (lock) {
      // Set explicit 2-second lock timeout to fail fast under extreme contention & prevent deadlocks
      await this.em.getKnex().raw("SET LOCAL lock_timeout = '2000ms'");
    }

    const entity = await this.em.findOne(
      WalletMikroEntity,
      { id },
      { lockMode: lock ? LockMode.PESSIMISTIC_WRITE : undefined },
    );
    return entity ? entity.toDomain() : null;
  }

  public async findByPlayerAndCurrency(
    playerId: string,
    currency: string,
    lock: boolean = false,
  ): Promise<Wallet | null> {
    if (lock) {
      await this.em.getKnex().raw("SET LOCAL lock_timeout = '2000ms'");
    }

    const entity = await this.em.findOne(
      WalletMikroEntity,
      { playerId, currency },
      { lockMode: lock ? LockMode.PESSIMISTIC_WRITE : undefined },
    );
    return entity ? entity.toDomain() : null;
  }

  public async save(wallet: Wallet): Promise<void> {
    const entity = WalletMikroEntity.fromDomain(wallet);
    await this.em.upsert(entity);
  }
}
