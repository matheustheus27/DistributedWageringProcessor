import { MoneyProps } from "../src/modules/wallet/domain/money";

interface LoadTestStats {
  totalRequests: number;
  successfulRequests: number;
  duplicateReplays: number;
  concurrencyConflicts: number;
  failedRequests: number;
  durationSeconds: number;
  rps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

const BASE_URL = process.env.APP_URL || "http://localhost:3000";

async function runLoadTest(): Promise<void> {
  console.log("=================================================");
  console.log("🚀 STARTING AUTOMATED LOAD & RESILIENCE SUITE 🚀");
  console.log("=================================================");
  console.log(`Targeting server: ${BASE_URL}\n`);

  // Step 1: Create a Hot Wallet with R$ 10,000.00
  const playerId = `load-player-${Date.now()}`;
  console.log(`1. Creating Hot Wallet for player '${playerId}'...`);
  
  const createWalletRes = await fetch(`${BASE_URL}/wallets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playerId,
      initialBalance: { amount: "10000.00", currency: "BRL" },
    }),
  });

  if (!createWalletRes.ok) {
    console.error("Failed to create wallet for load test. Is the server running? (`docker compose up`)");
    process.exit(1);
  }

  const walletData = await createWalletRes.json();
  const walletId = walletData.id;
  console.log(`✅ Hot Wallet created successfully! ID: ${walletId}\n`);

  // Scenario 1: Hot Wallet Concurrency (100 parallel requests on the SAME wallet)
  console.log("2. Executing Scenario 1: Hot Wallet Concurrency (100 parallel bets)...");
  const startTime = Date.now();
  const latencies: number[] = [];

  let successCount = 0;
  let replayCount = 0;
  let conflictCount = 0;
  let failCount = 0;

  const requests = Array.from({ length: 100 }, async (_, index) => {
    const reqStart = Date.now();
    const extTxId = `load-tx-${index}`;

    try {
      const res = await fetch(`${BASE_URL}/wagering/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `provider-load:${extTxId}`,
        },
        body: JSON.stringify({
          providerId: "provider-load",
          externalTransactionId: extTxId,
          playerId,
          walletId,
          roundId: `round-${index}`,
          gameId: "fortune-load",
          kind: "BET",
          money: { amount: "10.00", currency: "BRL" },
        }),
      });

      const lat = Date.now() - reqStart;
      latencies.push(lat);

      if (res.status === 200) {
        const body = await res.json();
        if (body.idempotentReplay) {
          replayCount++;
        } else {
          successCount++;
        }
      } else if (res.status === 409) {
        conflictCount++;
      } else {
        failCount++;
      }
    } catch {
      failCount++;
    }
  });

  await Promise.all(requests);
  const totalDuration = (Date.now() - startTime) / 1000;

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const rps = parseFloat((100 / totalDuration).toFixed(2));

  console.log("\n=================================================");
  console.log("📊 LOAD TEST METRICS & BENCHMARK SUMMARY 📊");
  console.log("=================================================");
  console.log(`Total Requests Sent : 100`);
  console.log(`Duration            : ${totalDuration.toFixed(2)}s`);
  console.log(`Throughput (RPS)    : ${rps} req/sec`);
  console.log(`Successful Debits   : ${successCount}`);
  console.log(`Idempotent Replays  : ${replayCount}`);
  console.log(`Conflicts (409)     : ${conflictCount}`);
  console.log(`Failed Requests     : ${failCount}`);
  console.log(`Latency p50         : ${p50} ms`);
  console.log(`Latency p95         : ${p95} ms`);
  console.log(`Latency p99         : ${p99} ms`);
  console.log("=================================================");

  // Verification: Check final balance vs reconciliation
  console.log("\n3. Verifying final wallet balance reconciliation...");
  const reconRes = await fetch(`${BASE_URL}/wallets/${walletId}/reconciliation`, {
    method: "POST",
  });
  const reconData = await reconRes.json();
  console.log(`Reconciliation result: Consistent = ${reconData.consistent}, Stored = ${reconData.storedBalance.amount}, Calculated = ${reconData.calculatedBalance.amount}`);

  if (reconData.consistent) {
    console.log("✅ FINANCIAL CONSISTENCY VERIFIED 100% PERFECT!\n");
  } else {
    console.error("❌ FINANCIAL DIVERGENCE DETECTED!");
    process.exit(1);
  }
}

void runLoadTest();
