import { describe, expect, test } from "bun:test";
import { Wallet } from "../../src/modules/wallet/domain/wallet";
import { Money } from "../../src/modules/wallet/domain/money";
import { InsufficientBalanceError } from "../../src/core/errors/domain-error";
import { LedgerDirection } from "../../src/modules/wallet/domain/wallet-ledger-entry";

describe("Wallet Aggregate Root", () => {
  test("should open wallet with initial balance and version 1", () => {
    const initial = Money.from({ amount: "100.00", currency: "BRL" });
    const wallet = Wallet.open({ playerId: "player-1", initialBalance: initial });

    expect(wallet.playerId).toBe("player-1");
    expect(wallet.balance.amount).toBe("100.00");
    expect(wallet.version).toBe(1);
  });

  test("should credit wallet balance and increment version", () => {
    const wallet = Wallet.open({
      playerId: "player-1",
      initialBalance: Money.from({ amount: "50.00", currency: "BRL" }),
    });

    const creditAmount = Money.from({ amount: "25.00", currency: "BRL" });
    const entry = wallet.credit(creditAmount, "tx-1");

    expect(wallet.balance.amount).toBe("75.00");
    expect(wallet.version).toBe(2);
    expect(entry.direction).toBe(LedgerDirection.Credit);
    expect(entry.balanceBefore.amount).toBe("50.00");
    expect(entry.balanceAfter.amount).toBe("75.00");
    expect(entry.isBalanced()).toBe(true);
  });

  test("should debit wallet balance and increment version", () => {
    const wallet = Wallet.open({
      playerId: "player-1",
      initialBalance: Money.from({ amount: "100.00", currency: "BRL" }),
    });

    const debitAmount = Money.from({ amount: "40.00", currency: "BRL" });
    const entry = wallet.debit(debitAmount, "tx-2");

    expect(wallet.balance.amount).toBe("60.00");
    expect(wallet.version).toBe(2);
    expect(entry.direction).toBe(LedgerDirection.Debit);
    expect(entry.isBalanced()).toBe(true);
  });

  test("should throw InsufficientBalanceError if debit exceeds available balance", () => {
    const wallet = Wallet.open({
      playerId: "player-1",
      initialBalance: Money.from({ amount: "50.00", currency: "BRL" }),
    });

    const debitAmount = Money.from({ amount: "60.00", currency: "BRL" });
    expect(() => wallet.debit(debitAmount, "tx-3")).toThrow(InsufficientBalanceError);
    expect(wallet.balance.amount).toBe("50.00"); // Unchanged
    expect(wallet.version).toBe(1);
  });
});
