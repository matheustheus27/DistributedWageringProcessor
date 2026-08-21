import { Injectable } from "@nestjs/common";
import { Counter, Gauge, Histogram, Registry } from "prom-client";

@Injectable()
export class MetricsService {
  public readonly registry: Registry;
  public readonly transactionsTotal: Counter<string>;
  public readonly duplicatesTotal: Counter<string>;
  public readonly processingLatency: Histogram<string>;
  public readonly outboxLag: Gauge<string>;

  constructor() {
    this.registry = new Registry();

    this.transactionsTotal = new Counter({
      name: "wagering_transactions_total",
      help: "Total count of processed wagering transactions",
      labelNames: ["status", "kind", "provider"],
      registers: [this.registry],
    });

    this.duplicatesTotal = new Counter({
      name: "wagering_duplicates_detected_total",
      help: "Total count of detected duplicate transactions or idempotency replays",
      registers: [this.registry],
    });

    this.processingLatency = new Histogram({
      name: "wagering_transaction_processing_latency_seconds",
      help: "Latency of wager transaction processing in seconds",
      labelNames: ["kind"],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    this.outboxLag = new Gauge({
      name: "wagering_outbox_lag",
      help: "Number of pending outbox messages awaiting publication",
      registers: [this.registry],
    });
  }

  public async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }
}
