import { describe, expect, test } from "bun:test";
import {
  WagerTransaction,
  WagerTransactionKind,
  WagerTransactionStatus,
} from "../../src/modules/wagering/domain/wager-transaction";
import { Money } from "../../src/modules/wallet/domain/money";
import { InvalidTransactionStateError, DomainError } from "../../src/core/errors/domain-error";
import { FailureCode } from "../../src/core/errors/failure-codes";

describe("WagerTransaction Domain Entity", () => {
  test("should create BET transaction in PENDING status", () => {
    const tx = WagerTransaction.create({
      providerId: "provider-a",
      externalTransactionId: "ext-1",
      idempotencyKey: "provider-a:ext-1",
      payloadHash: "hash-123",
      walletId: "wallet-1",
      playerId: "player-1",
      roundId: "round-1",
      gameId: "game-1",
      kind: WagerTransactionKind.Bet,
      money: Money.from({ amount: "25.00", currency: "BRL" }),
    });

    expect(tx.status).toBe(WagerTransactionStatus.Pending);
    expect(tx.affectsBalance()).toBe(true);
    expect(tx.requiresReference()).toBe(false);
    expect(tx.isTerminal()).toBe(false);
  });

  test("should require referenceExternalTransactionId for REFUND and ROLLBACK", () => {
    expect(() =>
      WagerTransaction.create({
        providerId: "provider-a",
        externalTransactionId: "ext-refund",
        idempotencyKey: "provider-a:ext-refund",
        payloadHash: "hash-123",
        walletId: "wallet-1",
        playerId: "player-1",
        roundId: "round-1",
        gameId: "game-1",
        kind: WagerTransactionKind.Refund,
        money: Money.from({ amount: "25.00", currency: "BRL" }),
      }),
    ).toThrow(DomainError);
  });

  test("should transition status to PROCESSED and reject subsequent transitions", () => {
    const tx = WagerTransaction.create({
      providerId: "provider-a",
      externalTransactionId: "ext-1",
      idempotencyKey: "provider-a:ext-1",
      payloadHash: "hash-123",
      walletId: "wallet-1",
      playerId: "player-1",
      roundId: "round-1",
      gameId: "game-1",
      kind: WagerTransactionKind.Bet,
      money: Money.from({ amount: "25.00", currency: "BRL" }),
    });

    tx.markProcessed(undefined);
    expect(tx.status).toBe(WagerTransactionStatus.Processed);
    expect(tx.isTerminal()).toBe(true);

    // Attempting to modify terminal transaction throws InvalidTransactionStateError
    expect(() => tx.reject(FailureCode.INSUFFICIENT_FUNDS)).toThrow(
      InvalidTransactionStateError,
    );
  });
});
