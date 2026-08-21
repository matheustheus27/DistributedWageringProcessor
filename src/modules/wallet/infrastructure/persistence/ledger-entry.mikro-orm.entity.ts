import { Entity, PrimaryKey, Property, Index } from "@mikro-orm/core";
import { WalletLedgerEntry, LedgerDirection, AccountType } from "@modules/wallet/domain/wallet-ledger-entry";

@Entity({ tableName: "wallet_ledger_entries" })
@Index({ name: "idx_ledger_wallet_created", properties: ["walletId", "createdAt"] })
export class LedgerEntryMikroEntity {
  @PrimaryKey({ type: "uuid" })
  id!: string;

  @Property({ type: "uuid" })
  walletId!: string;

  @Property({ type: "uuid" })
  transactionId!: string;

  @Property({ type: "string" })
  direction!: LedgerDirection;

  @Property({ type: "string", default: AccountType.PlayerLiability })
  accountType!: AccountType;

  @Property({ type: "decimal", precision: 18, scale: 2 })
  amount!: string;

  @Property({ type: "string", length: 3 })
  currency!: string;

  @Property({ type: "decimal", precision: 18, scale: 2 })
  balanceBefore!: string;

  @Property({ type: "decimal", precision: 18, scale: 2 })
  balanceAfter!: string;

  @Property({ type: "datetime" })
  createdAt!: Date;

  public static fromDomain(entry: WalletLedgerEntry): LedgerEntryMikroEntity {
    const entity = new LedgerEntryMikroEntity();
    entity.id = entry.id;
    entity.walletId = entry.walletId;
    entity.transactionId = entry.transactionId;
    entity.direction = entry.direction;
    entity.accountType = entry.accountType;
    entity.amount = entry.money.amount;
    entity.currency = entry.money.currency;
    entity.balanceBefore = entry.balanceBefore.amount;
    entity.balanceAfter = entry.balanceAfter.amount;
    entity.createdAt = entry.createdAt;
    return entity;
  }

  public toDomain(): WalletLedgerEntry {
    return WalletLedgerEntry.rehydrate({
      id: this.id,
      walletId: this.walletId,
      transactionId: this.transactionId,
      direction: this.direction,
      accountType: this.accountType || AccountType.PlayerLiability,
      money: { amount: this.amount, currency: this.currency },
      balanceBefore: { amount: this.balanceBefore, currency: this.currency },
      balanceAfter: { amount: this.balanceAfter, currency: this.currency },
      createdAt: this.createdAt,
    });
  }
}
