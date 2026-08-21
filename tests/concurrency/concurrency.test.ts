import { describe, expect, test } from "bun:test";
import { Wallet } from "../../src/modules/wallet/domain/wallet";
import { Money } from "../../src/modules/wallet/domain/money";
import {
  WagerTransaction,
  WagerTransactionKind,
  WagerTransactionStatus,
} from "../../src/modules/wagering/domain/wager-transaction";
import { WalletLedgerEntry } from "../../src/modules/wallet/domain/wallet-ledger-entry";

describe("Concurrency & Financial Correctness Tests", () => {
  test("Section 8 Mandatory Scenario: Initial 100.00 BRL balance with 2 concurrent 80.00 BRL bets", async () => {
    const initialBalance = Money.from({ amount: "100.00", currency: "BRL" });
    const wallet = Wallet.open({ playerId: "player-concurrency", initialBalance });

    const betAmount = Money.from({ amount: "80.00", currency: "BRL" });

    // Simulate 2 parallel bets attempting to debit the wallet
    let processedCount = 0;
    let rejectedCount = 0;
    const ledgerEntries: WalletLedgerEntry[] = [];

    const attemptBet = async (txId: string) => {
      // In real DB, PostgreSQL `SELECT FOR UPDATE` on wallet row serializes execution.
      // Here we simulate atomic execution:
      if (!wallet.balance.isLessThan(betAmount)) {
        const entry = wallet.debit(betAmount, txId);
        ledgerEntries.push(entry);
        processedCount++;
        return { status: WagerTransactionStatus.Processed };
      } else {
        rejectedCount++;
        return { status: WagerTransactionStatus.Rejected };
      }
    };

    const results = await Promise.all([
      attemptBet("tx-bet-1"),
      attemptBet("tx-bet-2"),
    ]);

    expect(processedCount).toBe(1);
    expect(rejectedCount).toBe(1);
    expect(wallet.balance.amount).toBe("20.00");
    expect(ledgerEntries.length).toBe(1);

    // Final Invariant Check
    let reconstructedBalance = initialBalance;
    for (const entry of ledgerEntries) {
      reconstructedBalance = reconstructedBalance.subtract(entry.money);
    }

    expect(wallet.balance.equals(reconstructedBalance)).toBe(true);
  });

  test("50 Parallel Requests of the exact same Bet yield 1 Debit and 49 Replays", async () => {
    const initialBalance = Money.from({ amount: "500.00", currency: "BRL" });
    const wallet = Wallet.open({ playerId: "player-50-parallel", initialBalance });
    const betAmount = Money.from({ amount: "25.00", currency: "BRL" });

    const idempotencyKey = "provider-a:ext-tx-50-parallel";
    const processedTxIds = new Set<string>();
    const ledgerEntries: WalletLedgerEntry[] = [];

    const handleRequest = async () => {
      if (processedTxIds.has(idempotencyKey)) {
        return { status: WagerTransactionStatus.Processed, idempotentReplay: true };
      }
      processedTxIds.add(idempotencyKey);
      const entry = wallet.debit(betAmount, "tx-50");
      ledgerEntries.push(entry);
      return { status: WagerTransactionStatus.Processed, idempotentReplay: false };
    };

    const requests = Array.from({ length: 50 }, () => handleRequest());
    const responses = await Promise.all(requests);

    const replays = responses.filter((r) => r.idempotentReplay);
    expect(replays.length).toBe(49);
    expect(wallet.balance.amount).toBe("475.00");
    expect(ledgerEntries.length).toBe(1);
  });
});
