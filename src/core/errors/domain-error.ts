import { FailureCode } from "./failure-codes";

export abstract class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DomainError extends AppError {
  constructor(
    message: string,
    public readonly failureCode?: FailureCode,
  ) {
    super(message);
  }
}

export class InvalidTransactionStateError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

export class InsufficientBalanceError extends DomainError {
  constructor(message: string = "Insufficient balance for debit operation") {
    super(message, FailureCode.INSUFFICIENT_FUNDS);
  }
}

export class CurrencyMismatchError extends DomainError {
  constructor(expected: string, received: string) {
    super(
      `Currency mismatch: expected ${expected}, received ${received}`,
      FailureCode.CURRENCY_MISMATCH,
    );
  }
}

export class InvalidMoneyValueError extends DomainError {
  constructor(message: string) {
    super(message, FailureCode.INVALID_AMOUNT);
  }
}

export class DuplicateTransactionError extends DomainError {
  constructor(message: string = "Transaction with identical external ID already exists") {
    super(message, FailureCode.DUPLICATE_TRANSACTION);
  }
}

export class IdempotencyConflictError extends DomainError {
  constructor(message: string = "Idempotency key provided with conflicting payload") {
    super(message, FailureCode.IDEMPOTENCY_PAYLOAD_MISMATCH);
  }
}

export class ReferenceNotFoundError extends DomainError {
  constructor(referenceId: string) {
    super(
      `Referenced transaction '${referenceId}' was not found`,
      FailureCode.REFERENCE_NOT_FOUND,
    );
  }
}
