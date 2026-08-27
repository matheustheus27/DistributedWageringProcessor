# 01 — System Architecture & Diagrams 📐

## 1. Hexagonal Architecture (Ports and Adapters)

The system adopts **Hexagonal Architecture** to completely decouple the business domain from the NestJS framework, MikroORM, and SQS messaging drivers.

```
src/
├── core/                         # Shared primitives (Domain, Application, Errors)
├── modules/
│   ├── wallet/                   # 👛 Wallet Domain, Balance, and Ledger
│   ├── wagering/                 # 🎲 Wagering Transaction Domain (BET, WIN, LOSS, etc.)
│   └── messaging/                # 📬 Transactional Outbox and Inbox Pattern
└── shared/
    └── infrastructure/           # Unit of Work, SQL Migrations, Auth Guards, Telemetry
```

> [!NOTE]
> **Framework Isolation**: Domain logic (`Money`, `Wallet`, `WagerTransaction`, `WalletLedgerEntry`) contains zero imports from web frameworks or ORMs. All IO interactions are mediated by interfaces (Ports) in the application layer.

---

## 2. C4 Container Diagram

```mermaid
graph TB
    subgraph Clients[" 🌐 Game Providers "]
        Provider[iGaming Engine / Slot Provider]
    end

    subgraph Cluster[" 🚀 NestJS / Bun Cluster (3 Replicas) "]
        App1[App Instance 1]
        App2[App Instance 2]
        App3[App Instance 3]
    end

    subgraph Infra[" 🐘 Persistence & Messaging "]
        DB[(PostgreSQL 16\nRow Locking + Constraints)]
        SQS[LocalStack AWS SQS\nFIFO Queue]
    end

    subgraph Telemetry[" 📊 Observability "]
        Prometheus[Prometheus Metric Collector]
        Grafana[Grafana Dashboard]
    end

    Provider -->|HTTP REST / Idempotency-Key| App1
    Provider -->|Message Events| SQS

    SQS -->|Consume wager-transactions.fifo| App3

    App1 -->|SELECT FOR UPDATE / Unit of Work| DB
    App2 -->|SELECT FOR UPDATE / Unit of Work| DB
    App3 -->|SELECT FOR UPDATE / Unit of Work| DB

    App1 -.->|Outbox Poller SKIP LOCKED| SQS
    App2 -.->|Outbox Poller SKIP LOCKED| SQS

    Prometheus -->|Scrape /metrics| App1
    Grafana -->|Query Datasource| Prometheus
```

---

## 3. Transaction State Machine Diagram (`WagerTransaction`)

```mermaid
stateDiagram-v2
    [*] --> PENDING: WagerTransaction.create()

    PENDING --> PROCESSED: Transaction Applied Successfully (Balance Updated)
    PENDING --> PENDING_REFERENCE: Missing Reference (Out-of-order REFUND/ROLLBACK)
    PENDING --> REJECTED: Business Rule Violation (Insufficient Funds, Mismatch)
    PENDING --> FAILED: Permanent Infrastructure Error

    PENDING_REFERENCE --> PROCESSED: Reference Resolved by PendingReferenceWorker
    PENDING_REFERENCE --> REJECTED: TTL Expired (REFERENCE_NOT_FOUND)

    PROCESSED --> [*]: Immutable Terminal State
    REJECTED --> [*]: Immutable Terminal State
    FAILED --> [*]: Immutable Terminal State
```

> [!IMPORTANT]
> **Immutability of Terminal States**: The `PROCESSED`, `REJECTED`, and `FAILED` states are strictly immutable. Once transitioned to one of these states, no further state changes can occur on the same transaction.
