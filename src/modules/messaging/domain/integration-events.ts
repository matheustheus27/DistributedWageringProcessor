import { MoneyProps } from "@modules/wallet/domain/money";
import { LedgerDirection, WalletLedgerEntry } from "@modules/wallet/domain/wallet-ledger-entry";
import { Wallet } from "@modules/wallet/domain/wallet";
import { WagerTransaction } from "@modules/wagering/domain/wager-transaction";
import { FailureCode } from "@core/errors/failure-codes";

export interface IntegrationEventProps<T> {
  eventId?: string;
  aggregateId: string;
  correlationId: string;
  causationId?: string;
  occurredAt?: Date;
  data: T;
}

export abstract class IntegrationEvent<T> {
  abstract readonly eventType: string;
  abstract readonly version: number;

  readonly eventId: string;
  readonly aggregateId: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly occurredAt: Date;
  readonly data: Readonly<T>;

  protected constructor(props: IntegrationEventProps<T>) {
    this.eventId = props.eventId || crypto.randomUUID();
    this.aggregateId = props.aggregateId;
    this.correlationId = props.correlationId;
    this.causationId = props.causationId;
    this.occurredAt = props.occurredAt || new Date();
    this.data = Object.freeze(props.data);
  }

  public toJSON(): {
    eventId: string;
    eventType: string;
    aggregateId: string;
    correlationId: string;
    causationId?: string;
    occurredAt: string;
    version: number;
    data: T;
  } {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      aggregateId: this.aggregateId,
      correlationId: this.correlationId,
      causationId: this.causationId,
      occurredAt: this.occurredAt.toISOString(),
      version: this.version,
      data: this.data,
    };
  }
}

// 1. WalletBalanceChanged
export interface WalletBalanceChangedData {
  walletId: string;
  transactionId: string;
  direction: LedgerDirection;
  money: MoneyProps;
  balanceBefore: MoneyProps;
  balanceAfter: MoneyProps;
  walletVersion: number;
}

export class WalletBalanceChanged extends IntegrationEvent<WalletBalanceChangedData> {
  readonly eventType = "WalletBalanceChanged";
  readonly version = 1;

  public static from(
    wallet: Wallet,
    entry: WalletLedgerEntry,
    correlationId: string,
    causationId?: string,
  ): WalletBalanceChanged {
    return new WalletBalanceChanged({
      aggregateId: wallet.id,
      correlationId,
      causationId,
      data: {
        walletId: wallet.id,
        transactionId: entry.transactionId,
        direction: entry.direction,
        money: entry.money.toJSON(),
        balanceBefore: entry.balanceBefore.toJSON(),
        balanceAfter: entry.balanceAfter.toJSON(),
        walletVersion: wallet.version,
      },
    });
  }
}

// 2. WagerTransactionProcessed
export interface WagerTransactionProcessedData {
  transactionId: string;
  providerId: string;
  externalTransactionId: string;
  walletId: string;
  playerId: string;
  roundId: string;
  gameId: string;
  kind: string;
  money: MoneyProps;
  status: string;
  referenceTransactionId?: string;
  processedAt: string;
}

export class WagerTransactionProcessed extends IntegrationEvent<WagerTransactionProcessedData> {
  readonly eventType = "WagerTransactionProcessed";
  readonly version = 1;

  public static from(
    tx: WagerTransaction,
    correlationId: string,
    causationId?: string,
  ): WagerTransactionProcessed {
    return new WagerTransactionProcessed({
      aggregateId: tx.id,
      correlationId,
      causationId,
      data: {
        transactionId: tx.id,
        providerId: tx.providerId,
        externalTransactionId: tx.externalTransactionId,
        walletId: tx.walletId,
        playerId: tx.playerId,
        roundId: tx.roundId,
        gameId: tx.gameId,
        kind: tx.kind,
        money: tx.money.toJSON(),
        status: tx.status,
        referenceTransactionId: tx.referenceTransactionId,
        processedAt: (tx.processedAt || new Date()).toISOString(),
      },
    });
  }
}

// 3. WagerTransactionRejected
export interface WagerTransactionRejectedData {
  transactionId: string;
  providerId: string;
  externalTransactionId: string;
  walletId: string;
  playerId: string;
  roundId: string;
  gameId: string;
  kind: string;
  money: MoneyProps;
  failureCode: FailureCode;
}

export class WagerTransactionRejected extends IntegrationEvent<WagerTransactionRejectedData> {
  readonly eventType = "WagerTransactionRejected";
  readonly version = 1;

  public static from(
    tx: WagerTransaction,
    code: FailureCode,
    correlationId: string,
    causationId?: string,
  ): WagerTransactionRejected {
    return new WagerTransactionRejected({
      aggregateId: tx.id,
      correlationId,
      causationId,
      data: {
        transactionId: tx.id,
        providerId: tx.providerId,
        externalTransactionId: tx.externalTransactionId,
        walletId: tx.walletId,
        playerId: tx.playerId,
        roundId: tx.roundId,
        gameId: tx.gameId,
        kind: tx.kind,
        money: tx.money.toJSON(),
        failureCode: code,
      },
    });
  }
}

// 4. WagerTransactionPendingReference
export interface WagerTransactionPendingReferenceData {
  transactionId: string;
  providerId: string;
  externalTransactionId: string;
  referenceExternalTransactionId: string;
  walletId: string;
  playerId: string;
}

export class WagerTransactionPendingReference extends IntegrationEvent<WagerTransactionPendingReferenceData> {
  readonly eventType = "WagerTransactionPendingReference";
  readonly version = 1;

  public static from(
    tx: WagerTransaction,
    correlationId: string,
    causationId?: string,
  ): WagerTransactionPendingReference {
    return new WagerTransactionPendingReference({
      aggregateId: tx.id,
      correlationId,
      causationId,
      data: {
        transactionId: tx.id,
        providerId: tx.providerId,
        externalTransactionId: tx.externalTransactionId,
        referenceExternalTransactionId: tx.referenceExternalTransactionId!,
        walletId: tx.walletId,
        playerId: tx.playerId,
      },
    });
  }
}
