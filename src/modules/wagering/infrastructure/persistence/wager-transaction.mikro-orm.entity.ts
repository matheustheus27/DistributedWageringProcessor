import { Entity, PrimaryKey, Property, Unique, Index } from "@mikro-orm/core";
import {
  WagerTransaction,
  WagerTransactionKind,
  WagerTransactionStatus,
} from "@modules/wagering/domain/wager-transaction";
import { FailureCode } from "@core/errors/failure-codes";

@Entity({ tableName: "wager_transactions" })
@Unique({ name: "unique_provider_ext_tx", properties: ["providerId", "externalTransactionId"] })
@Unique({ name: "unique_provider_idempotency_key", properties: ["providerId", "idempotencyKey"] })
@Index({ name: "idx_wager_status", properties: ["status"] })
@Index({ name: "idx_wager_ref_ext_tx", properties: ["providerId", "referenceExternalTransactionId"] })
export class WagerTransactionMikroEntity {
  @PrimaryKey({ type: "uuid" })
  id!: string;

  @Property({ type: "string" })
  providerId!: string;

  @Property({ type: "string" })
  externalTransactionId!: string;

  @Property({ type: "string" })
  idempotencyKey!: string;

  @Property({ type: "string" })
  payloadHash!: string;

  @Property({ type: "uuid" })
  walletId!: string;

  @Property({ type: "string" })
  playerId!: string;

  @Property({ type: "string" })
  roundId!: string;

  @Property({ type: "string" })
  gameId!: string;

  @Property({ type: "string" })
  kind!: WagerTransactionKind;

  @Property({ type: "decimal", precision: 18, scale: 2 })
  amount!: string;

  @Property({ type: "string", length: 3 })
  currency!: string;

  @Property({ type: "string", nullable: true })
  referenceExternalTransactionId?: string;

  @Property({ type: "string" })
  status!: WagerTransactionStatus;

  @Property({ type: "uuid", nullable: true })
  referenceTransactionId?: string;

  @Property({ type: "string", nullable: true })
  failureCode?: FailureCode;

  @Property({ type: "datetime" })
  createdAt!: Date;

  @Property({ type: "datetime", nullable: true })
  processedAt?: Date;

  public static fromDomain(tx: WagerTransaction): WagerTransactionMikroEntity {
    const entity = new WagerTransactionMikroEntity();
    entity.id = tx.id;
    entity.providerId = tx.providerId;
    entity.externalTransactionId = tx.externalTransactionId;
    entity.idempotencyKey = tx.idempotencyKey;
    entity.payloadHash = tx.payloadHash;
    entity.walletId = tx.walletId;
    entity.playerId = tx.playerId;
    entity.roundId = tx.roundId;
    entity.gameId = tx.gameId;
    entity.kind = tx.kind;
    entity.amount = tx.money.amount;
    entity.currency = tx.money.currency;
    entity.referenceExternalTransactionId = tx.referenceExternalTransactionId;
    entity.status = tx.status;
    entity.referenceTransactionId = tx.referenceTransactionId;
    entity.failureCode = tx.failureCode;
    entity.createdAt = tx.createdAt;
    entity.processedAt = tx.processedAt;
    return entity;
  }

  public toDomain(): WagerTransaction {
    return WagerTransaction.rehydrate({
      id: this.id,
      providerId: this.providerId,
      externalTransactionId: this.externalTransactionId,
      idempotencyKey: this.idempotencyKey,
      payloadHash: this.payloadHash,
      walletId: this.walletId,
      playerId: this.playerId,
      roundId: this.roundId,
      gameId: this.gameId,
      kind: this.kind,
      money: { amount: this.amount, currency: this.currency },
      referenceExternalTransactionId: this.referenceExternalTransactionId,
      status: this.status,
      referenceTransactionId: this.referenceTransactionId,
      failureCode: this.failureCode,
      createdAt: this.createdAt,
      processedAt: this.processedAt,
    });
  }
}
