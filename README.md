# Distributed Wagering Processor 🦧

Financial distributed wagering processor for iGaming developed as part of the **Jungle Gaming Technical Challenge**. Built with **Bun 1.x**, **TypeScript**, **NestJS**, **MikroORM**, **PostgreSQL**, and **AWS SQS** (LocalStack).

---

## 🚀 Quick Start

### 1. Requirements
- [Bun 1.x](https://bun.sh/)
- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)

### 2. Run with Docker Compose
To build and start PostgreSQL, LocalStack (SQS FIFO queues), and 3 scaled instances of the application:

```bash
docker compose up --build --scale app=3
```

The application will be accessible at `http://localhost:3000`.

### 3. Local Development (without Docker for app)

Start PostgreSQL and LocalStack:
```bash
docker compose up postgres localstack -d
```

Install dependencies and run migrations:
```bash
bun install
bun run migration:up
```

Run in dev mode with watch:
```bash
bun run start:dev
```

---

## 🧪 Testing

Run unit tests:
```bash
bun test tests/unit
```

Run concurrency & financial correctness tests:
```bash
bun test tests/concurrency
```

Run all tests:
```bash
bun test tests/
```

---

## 📡 API Reference

### Health Checks (Unauthenticated)
- `GET /health/live`: Liveness check.
- `GET /health/ready`: Readiness check (verifies PostgreSQL and LocalStack SQS connectivity).
- `GET /metrics`: Prometheus metrics exporter.

### Wallets (`/wallets`)
#### `POST /wallets`
Create a new player wallet with optional initial balance (generates internal `OPENING` transaction & `CREDIT` ledger entry).

```json
{
  "playerId": "0192f28f-5dc0-7d58-bdb2-814ad6a0f4a1",
  "initialBalance": { "amount": "1000.00", "currency": "BRL" }
}
```

#### `GET /wallets/:walletId`
Fetch wallet details and current balance.

#### `GET /wallets/:walletId/ledger?cursor=...&limit=50`
Fetch wallet ledger history with cursor-based pagination.

#### `POST /wallets/:walletId/reconciliation`
Reconcile wallet stored balance against the sum of ledger entries. Returns difference and consistency boolean.

---

### Wagering Transactions (`/wagering/transactions`)
#### `POST /wagering/transactions`
Header: `Idempotency-Key: provider-a:transaction-123`

```json
{
  "providerId": "provider-a",
  "externalTransactionId": "transaction-123",
  "playerId": "0192f28f-5dc0-7d58-bdb2-814ad6a0f4a1",
  "walletId": "0192f291-27dd-7d3f-8071-5f8685deef37",
  "roundId": "round-987",
  "gameId": "fortune-chimp",
  "kind": "BET",
  "money": { "amount": "25.00", "currency": "BRL" }
}
```

Response:
```json
{
  "transactionId": "0192f298-345e-7e38-af88-e43f851a819d",
  "status": "PROCESSED",
  "balance": { "amount": "975.00", "currency": "BRL" },
  "idempotentReplay": false
}
```

Supported operation kinds:
- `BET`: Debits wallet. Rejection with `INSUFFICIENT_FUNDS` if balance is insufficient.
- `WIN`: Credits wallet.
- `LOSS`: Records round result without moving balance or creating ledger entry.
- `REFUND`: Reverts a `PROCESSED` `BET` once (credits wallet).
- `ROLLBACK`: Reverts a `PROCESSED` `BET`, `WIN`, or `REFUND` once.

---

## 📬 SQS Integration (Transactional Outbox / Inbox)

Queue: `wager-transactions.fifo`
DLQ: `wager-transactions-dlq.fifo`

Message structure:
```json
{
  "messageId": "msg-123",
  "type": "WagerTransactionRequested",
  "occurredAt": "2026-08-21T16:00:00.000Z",
  "data": {
    "providerId": "provider-a",
    "externalTransactionId": "transaction-123",
    "idempotencyKey": "provider-a:transaction-123",
    "playerId": "0192f28f-5dc0-7d58-bdb2-814ad6a0f4a1",
    "walletId": "0192f291-27dd-7d3f-8071-5f8685deef37",
    "roundId": "round-987",
    "gameId": "fortune-chimp",
    "kind": "BET",
    "money": { "amount": "25.00", "currency": "BRL" }
  }
}
```
