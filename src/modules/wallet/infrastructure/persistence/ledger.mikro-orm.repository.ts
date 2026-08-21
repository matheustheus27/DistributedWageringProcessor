import { Injectable } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { WalletLedgerEntry, LedgerDirection } from "@modules/wallet/domain/wallet-ledger-entry";
import { Money } from "@modules/wallet/domain/money";
import {
  ILedgerRepository,
  LedgerPaginationResult,
} from "@modules/wallet/application/ports/ledger.repository.port";
import { LedgerEntryMikroEntity } from "./ledger-entry.mikro-orm.entity";

@Injectable()
export class LedgerMikroRepository implements ILedgerRepository {
  constructor(private readonly em: EntityManager) {}

  public async save(entry: WalletLedgerEntry): Promise<void> {
    const entity = LedgerEntryMikroEntity.fromDomain(entry);
    await this.em.persistAndFlush(entity);
  }

  public async findByWalletId(
    walletId: string,
    limit: number = 50,
    cursor?: string,
  ): Promise<LedgerPaginationResult> {
    const qb = this.em.createQueryBuilder(LedgerEntryMikroEntity).where({ walletId });

    if (cursor) {
      const cursorDate = new Date(cursor);
      qb.andWhere({ createdAt: { $lt: cursorDate } });
    }

    qb.orderBy({ createdAt: "DESC" }).limit(limit + 1);

    const entities = await qb.getResultList();
    const hasNext = entities.length > limit;
    const results = hasNext ? entities.slice(0, limit) : entities;

    const nextCursor = hasNext && results.length > 0
      ? results[results.length - 1].createdAt.toISOString()
      : undefined;

    return {
      entries: results.map((e) => e.toDomain()),
      nextCursor,
    };
  }

  public async calculateBalance(walletId: string, currency: string): Promise<Money> {
    const knex = this.em.getKnex();
    const res = await knex("wallet_ledger_entries")
      .where({ wallet_id: walletId })
      .select(
        knex.raw(
          "COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE -amount END), 0) as total",
        ),
      )
      .first();

    const totalStr = res && res.total !== undefined ? Number(res.total).toFixed(2) : "0.00";
    return Money.from({ amount: totalStr, currency });
  }

  public async countEntries(walletId: string): Promise<number> {
    return await this.em.count(LedgerEntryMikroEntity, { walletId });
  }
}
