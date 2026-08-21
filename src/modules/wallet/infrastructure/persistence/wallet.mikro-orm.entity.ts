import { Entity, PrimaryKey, Property, Unique, Check } from "@mikro-orm/core";
import { Wallet } from "@modules/wallet/domain/wallet";

@Entity({ tableName: "wallets" })
@Unique({ name: "unique_player_currency", properties: ["playerId", "currency"] })
@Check({ expression: "balance >= 0" })
export class WalletMikroEntity {
  @PrimaryKey({ type: "uuid" })
  id!: string;

  @Property({ type: "string" })
  playerId!: string;

  @Property({ type: "string", length: 3 })
  currency!: string;

  @Property({ type: "decimal", precision: 18, scale: 2 })
  balance!: string;

  @Property({ type: "integer", default: 1 })
  version!: number;

  @Property({ type: "datetime" })
  createdAt!: Date;

  @Property({ type: "datetime" })
  updatedAt!: Date;

  public static fromDomain(wallet: Wallet): WalletMikroEntity {
    const entity = new WalletMikroEntity();
    entity.id = wallet.id;
    entity.playerId = wallet.playerId;
    entity.currency = wallet.currency;
    entity.balance = wallet.balance.amount;
    entity.version = wallet.version;
    entity.createdAt = wallet.createdAt;
    entity.updatedAt = wallet.updatedAt;
    return entity;
  }

  public toDomain(): Wallet {
    return Wallet.rehydrate({
      id: this.id,
      playerId: this.playerId,
      currency: this.currency,
      balance: { amount: this.balance, currency: this.currency },
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    });
  }
}
