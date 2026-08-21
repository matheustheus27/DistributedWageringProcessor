const BASE_URL = process.env.APP_URL || "http://localhost:3000";

async function runSmokeTest(): Promise<void> {
  console.log("=================================================");
  console.log("🧪 STARTING E2E SMOKE & RESILIENCE VERIFICATION 🧪");
  console.log("=================================================");
  console.log(`Targeting server: ${BASE_URL}\n`);

  const playerId = `smoke-player-${Date.now()}`;
  console.log(`1. Opening wallet for player '${playerId}' with R$ 100.00 BRL...`);

  const openRes = await fetch(`${BASE_URL}/wallets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playerId,
      initialBalance: { amount: "100.00", currency: "BRL" },
    }),
  });

  if (!openRes.ok) {
    console.error("❌ Failed to open wallet for smoke test. Make sure server is running (`docker compose up`)");
    process.exit(1);
  }

  const wallet = await openRes.json();
  const walletId = wallet.id;
  console.log(`✅ Wallet opened successfully! Wallet ID: ${walletId}\n`);

  console.log("2. Sending 2 CONCURRENT bets of R$ 80.00 BRL (disputing R$ 100.00 balance)...");

  const sendBet = async (extTxId: string) => {
    const res = await fetch(`${BASE_URL}/wagering/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `smoke-provider:${extTxId}`,
      },
      body: JSON.stringify({
        providerId: "smoke-provider",
        externalTransactionId: extTxId,
        playerId,
        walletId,
        roundId: "smoke-round-1",
        gameId: "fortune-chimp",
        kind: "BET",
        money: { amount: "80.00", currency: "BRL" },
      }),
    });
    return await res.json();
  };

  const [res1, res2] = await Promise.all([
    sendBet("tx-smoke-1"),
    sendBet("tx-smoke-2"),
  ]);

  console.log("\nResponse 1:", res1);
  console.log("Response 2:", res2);

  const processedCount = [res1, res2].filter((r) => r.status === "PROCESSED").length;
  const rejectedCount = [res1, res2].filter((r) => r.status === "REJECTED").length;

  console.log(`\nProcessed Bets: ${processedCount} | Rejected Bets: ${rejectedCount}`);

  if (processedCount === 1 && rejectedCount === 1) {
    console.log("✅ Concurrency race condition correctly handled! Exactly 1 bet processed, 1 rejected.");
  } else {
    console.error("❌ Concurrency test failed! Race condition occurred.");
    process.exit(1);
  }

  console.log("\n3. Executing Wallet Balance Reconciliation...");
  const reconRes = await fetch(`${BASE_URL}/wallets/${walletId}/reconciliation`, {
    method: "POST",
  });
  const recon = await reconRes.json();

  console.log("Reconciliation Output:", recon);

  if (recon.consistent && recon.storedBalance.amount === "20.00") {
    console.log("\n=================================================");
    console.log("🎉 SMOKE TEST PASSED 100% PERFECT! 🎉");
    console.log("Stored Balance: R$ 20.00 BRL | Ledger Consistent: TRUE");
    console.log("=================================================\n");
  } else {
    console.error("❌ Financial reconciliation check failed!");
    process.exit(1);
  }
}

void runSmokeTest();
