import { Money, MoneyProps } from "@modules/wallet/domain/money";
import { LedgerDirection } from "@modules/wallet/domain/wallet-ledger-entry";
import { FailureCode } from "@core/errors/failure-codes";
import { InvalidTransactionStateError, DomainError } from "@core/errors/domain-error";

export enum WagerTransactionKind {
  Opening = "OPENING",
  Bet = "BET",
  Win = "WIN",
  Loss = "LOSS",
  Refund = "REFUND",
  Rollback = "ROLLBACK",
}

export enum WagerTransactionStatus {
  Pending = "PENDING",
  PendingReference = "PENDING_REFERENCE",
  Processed = "PROCESSED",
  Rejected = "REJECTED",
  Failed = "FAILED",
}

export interface CreateWagerTransactionProps {
  id?: string;
  providerId: string;
  externalTransactionId: string;
  idempotencyKey: string;
  payloadHash: string;
  walletId: string;
  playerId: string;
  roundId: string;
  gameId: string;
  kind: WagerTransactionKind;
  money: Money;
  referenceExternalTransactionId?: string;
  createdAt?: Date;
}

export interface WagerTransactionState {
  id: string;
  providerId: string;
  externalTransactionId: string;
  idempotencyKey: string;
  payloadHash: string;
  walletId: string;
  playerId: string;
  roundId: string;
  gameId: string;
  kind: WagerTransactionKind;
  money: MoneyProps;
  referenceExternalTransactionId?: string;
  createdAt: Date;
  status: WagerTransactionStatus;
  referenceTransactionId?: string;
  failureCode?: FailureCode;
  processedAt?: Date;
}

export class WagerTransaction {
  private constructor(
    public readonly id: string,
    public readonly providerId: string,
    public readonly externalTransactionId: string,
    public readonly idempotencyKey: string,
    public readonly payloadHash: string,
    public readonly walletId: string,
    public readonly playerId: string,
    public readonly roundId: string,
    public readonly gameId: string,
    public readonly kind: WagerTransactionKind,
    public readonly money: Money,
    public readonly referenceExternalTransactionId: string | undefined,
    public readonly createdAt: Date,
    private _status: WagerTransactionStatus,
    private _referenceTransactionId?: string,
    private _failureCode?: FailureCode,
    private _processedAt?: Date,
  ) {}

  public static create(props: CreateWagerTransactionProps): WagerTransaction {
    const id = props.id || crypto.randomUUID();
    const createdAt = props.createdAt || new Date();

    if (props.kind === WagerTransactionKind.Refund || props.kind === WagerTransactionKind.Rollback) {
      if (!props.referenceExternalTransactionId) {
        throw new DomainError(
          `Operation kind '${props.kind}' requires a referenceExternalTransactionId`,
          FailureCode.REFERENCE_NOT_FOUND,
        );
      }
    }

    return new WagerTransaction(
      id,
      props.providerId,
      props.externalTransactionId,
      props.idempotencyKey,
      props.payloadHash,
      props.walletId,
      props.playerId,
      props.roundId,
      props.gameId,
      props.kind,
      props.money,
      props.referenceExternalTransactionId,
      createdAt,
      WagerTransactionStatus.Pending,
    );
  }

  public static rehydrate(state: WagerTransactionState): WagerTransaction {
    return new WagerTransaction(
      state.id,
      state.providerId,
      state.externalTransactionId,
      state.idempotencyKey,
      state.payloadHash,
      state.walletId,
      state.playerId,
      state.roundId,
      state.gameId,
      state.kind,
      Money.from(state.money),
      state.referenceExternalTransactionId,
      new Date(state.createdAt),
      state.status,
      state.referenceTransactionId,
      state.failureCode,
      state.processedAt ? new Date(state.processedAt) : undefined,
    );
  }

  get status(): WagerTransactionStatus {
    return this._status;
  }

  get referenceTransactionId(): string | undefined {
    return this._referenceTransactionId;
  }

  get failureCode(): FailureCode | undefined {
    return this._failureCode;
  }

  get processedAt(): Date | undefined {
    return this._processedAt;
  }

  public markProcessed(referenceTransactionId: string | undefined, at: Date = new Date()): void {
    this.assertNotTerminal("markProcessed");
    this._status = WagerTransactionStatus.Processed;
    this._referenceTransactionId = referenceTransactionId || this._referenceTransactionId;
    this._processedAt = at;
  }

  public markPendingReference(): void {
    this.assertNotTerminal("markPendingReference");
    this._status = WagerTransactionStatus.PendingReference;
  }

  public reject(code: FailureCode): void {
    this.assertNotTerminal("reject");
    this._status = WagerTransactionStatus.Rejected;
    this._failureCode = code;
    this._processedAt = new Date();
  }

  public fail(code: FailureCode): void {
    this.assertNotTerminal("fail");
    this._status = WagerTransactionStatus.Failed;
    this._failureCode = code;
    this._processedAt = new Date();
  }

  public isTerminal(): boolean {
    return (
      this._status === WagerTransactionStatus.Processed ||
      this._status === WagerTransactionStatus.Rejected ||
      this._status === WagerTransactionStatus.Failed
    );
  }

  public affectsBalance(): boolean {
    return this.kind !== WagerTransactionKind.Loss;
  }

  public requiresReference(): boolean {
    return (
      this.kind === WagerTransactionKind.Refund ||
      this.kind === WagerTransactionKind.Rollback
    );
  }

  public matchesPayload(payloadHash: string): boolean {
    return this.payloadHash === payloadHash;
  }

  public ledgerDirectionFor(reference?: WagerTransaction): LedgerDirection {
    switch (this.kind) {
      case WagerTransactionKind.Opening:
      case WagerTransactionKind.Win:
        return LedgerDirection.Credit;
      case WagerTransactionKind.Bet:
        return LedgerDirection.Debit;
      case WagerTransactionKind.Refund:
        // Reverts a BET, so it's a CREDIT
        return LedgerDirection.Credit;
      case WagerTransactionKind.Rollback:
        if (!reference) {
          throw new DomainError("Cannot determine ledger direction for ROLLBACK without reference transaction");
        }
        // Invert reference transaction effect
        if (reference.kind === WagerTransactionKind.Bet) {
          return LedgerDirection.Credit; // Reverting BET -> CREDIT
        } else if (reference.kind === WagerTransactionKind.Win || reference.kind === WagerTransactionKind.Refund) {
          return LedgerDirection.Debit; // Reverting WIN or REFUND -> DEBIT
        }
        throw new DomainError(`Unsupported reference kind '${reference.kind}' for ROLLBACK`);
      case WagerTransactionKind.Loss:
        throw new DomainError("LOSS transaction does not produce ledger entry");
      default:
        throw new DomainError(`Unknown wager transaction kind '${this.kind}'`);
    }
  }

  private assertNotTerminal(action: string): void {
    if (this.isTerminal()) {
      throw new InvalidTransactionStateError(
        `Cannot execute '${action}' on transaction '${this.id}' in terminal state '${this._status}'`,
      );
    }
  }
}
