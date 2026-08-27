# 00 — System Overview

## 1. Business Context

```mermaid
flowchart LR
    Provider["🎮 Game Provider (Slot Engine)"] -->|HTTP REST / SQS FIFO| API["🚀 Distributed Wagering Processor"]
    API -->|SELECT FOR UPDATE / Unit of Work| DB[("PostgreSQL 16\n(Wallet/Ledger/Inbox/Outbox)")]
```

---

## 2. The Distributed Systems Challenge

> [!WARNING]
> In a high-concurrency environment with thousands of simultaneous bettors, the system faces 4 major challenges:

1. **Redelivery & Redundancy**: Messages can be delivered **more than once** (*at-least-once*) due to network flakiness.
2. **Out-of-Order Delivery**: A request for a refund (`REFUND`) or reversal (`ROLLBACK`) may arrive at the system **before** the original bet (`BET`).
3. **Concurrent Balance Contention (*Hot Wallet*)**: Multiple game tabs or parallel requests may try to debit the balance of the same wallet in the exact same millisecond.
4. **Infrastructure Outages**: The application server may crash immediately after writing the transaction to the database, but before acknowledging message consumption to the broker (*SQS ACK*).

---

## 3. PostgreSQL Database Model (`erDiagram`)

The relational diagram below illustrates the structure of the 5 PostgreSQL tables along with their primary keys and relationships:

```mermaid
erDiagram
    wallets {
        uuid id PK
        string player_id UK
        string currency UK
        numeric balance "NUMERIC(18,2) CHECK >= 0"
        int version "DEFAULT 1"
        timestamp created_at
        timestamp updated_at
    }

    wallet_ledger_entries {
        uuid id PK
        uuid wallet_id FK
        uuid transaction_id FK
        string direction "DEBIT / CREDIT"
        string account_type "PLAYER_LIABILITY / HOUSE_PLATFORM / PROVIDER_SETTLEMENT"
        numeric amount "NUMERIC(18,2)"
        string currency
        numeric balance_before "NUMERIC(18,2)"
        numeric balance_after "NUMERIC(18,2) CHECK >= 0"
        timestamp created_at
    }

    wager_transactions {
        uuid id PK
        string provider_id UK
        string external_transaction_id UK
        string idempotency_key UK
        string player_id
        uuid wallet_id FK
        string round_id
        string game_id
        string kind "BET / WIN / LOSS / REFUND / ROLLBACK"
        string status "PENDING / PROCESSED / REJECTED / PENDING_REFERENCE"
        numeric amount "NUMERIC(18,2)"
        string currency
        string payload_hash "SHA-256 Digest"
        timestamp created_at
        timestamp updated_at
    }

    inbox_messages {
        string consumer_name PK
        string message_id PK
        timestamp processed_at
    }

    outbox_messages {
        uuid id PK
        string event_type
        jsonb payload
        timestamp occurred_at
        timestamp published_at "INDEX idx_outbox_pending"
        int attempts "DEFAULT 0"
    }

    wallets ||--o{ wallet_ledger_entries : "has ledger entries"
    wallets ||--o{ wager_transactions : "has transactions"
    wager_transactions ||--o{ wallet_ledger_entries : "generates ledger entries"
```

---

## 4. Inviolable Global Invariants

> [!IMPORTANT]
> Financial consistency rules are guaranteed natively and strictly within the PostgreSQL schema itself:

| Invariant | Description | Enforcement Mechanism |
|---|---|---|
| **Financial Precision** | Absolute prohibition of floating-point types (`number`/`float`). Money is treated as exact decimal strings. | `Money` Class using `Decimal.js` and SQL column `NUMERIC(18,2)`. |
| **Non-Negative Balance** | The wallet balance can never become negative, even under simultaneous concurrent disputes. | `CONSTRAINT check_non_negative_balance CHECK (balance >= 0)`. |
| **Auditable Ledger** | Every financial movement requires a balanced ledger entry between liability and revenue accounts. | Immutable `WalletLedgerEntry` and `CONSTRAINT check_ledger_arithmetic`. |
| **Persistent Idempotency** | Re-sending the same request with the same key returns the original result without duplicating credits or debits. | Unique constraint `(provider_id, idempotency_key)` and `inbox_messages` table. |
