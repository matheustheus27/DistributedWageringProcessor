# 01 — Arquitetura do Sistema & Diagramas 📐

## 1. Arquitetura Hexagonal (Ports and Adapters)

O sistema adota **Hexagonal Architecture** para isolar completamente o domínio de negócio em relação ao framework NestJS, ao ORM MikroORM e aos drivers de mensageria SQS.

```
src/
├── core/                         # Primitivas compartilhadas (Domain, Application, Errors)
├── modules/
│   ├── wallet/                   # 👛 Domínio da Carteira, Saldo e Extrato
│   ├── wagering/                 # 🎲 Domínio das Transações de Aposta (BET, WIN, LOSS, etc.)
│   └── messaging/                # 📬 Transactional Outbox e Inbox Pattern
└── shared/
    └── infrastructure/           # Unit of Work, Migrações SQL, Guardas de Auth e Telemetria
```

### Camadas e Suas Responsabilidades:
1. **Domínio (`domain/`)**: Regras de negócio puras (`Money`, `Wallet`, `WagerTransaction`, `WalletLedgerEntry`). Sem dependências externas.
2. **Aplicação (`application/`)**: Casos de uso (`ProcessWagerUseCase`, `OpenWalletUseCase`) e contratos de repositório (Ports).
3. **Infraestrutura (`infrastructure/`)**: Implementações concretas de repositórios MikroORM, Controllers HTTP e Consumidores SQS (Adapters).

---

## 2. Diagrama C4 de Contêineres

```mermaid
graph TB
    subgraph Clients[" 🌐 Provedores de Jogos "]
        Provider[iGaming Engine / Slot Provider]
    end

    subgraph Cluster[" 🚀 Cluster NestJS / Bun (3 Réplicas) "]
        App1[Instância App 1]
        App2[Instância App 2]
        App3[Instância App 3]
    end

    subgraph Infra[" 🐘 Persistência & Fila "]
        DB[(PostgreSQL 16\nRow Locking + Constraints)]
        SQS[LocalStack AWS SQS\nFIFO Queue]
    end

    subgraph Telemetry[" 📊 Observabilidade "]
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

## 3. Diagrama de Estados da Transação (`WagerTransaction`)

```mermaid
stateDiagram-v2
    [*] --> PENDING: WagerTransaction.create()
    
    PENDING --> PROCESSED: Transação Aplicada com Sucesso (Saldo Atualizado)
    PENDING --> PENDING_REFERENCE: Referência Ausente (REFUND/ROLLBACK out-of-order)
    PENDING --> REJECTED: Violação de Regra (Saldo Insuficiente, Mismatch)
    PENDING --> FAILED: Erro Permanente de Infraestrutura

    PENDING_REFERENCE --> PROCESSED: Referência Resolvida pelo PendingReferenceWorker
    PENDING_REFERENCE --> REJECTED: TTL Expirado (REFERENCE_NOT_FOUND)

    PROCESSED --> [*]: Estado Terminal Imutável
    REJECTED --> [*]: Estado Terminal Imutável
    FAILED --> [*]: Estado Terminal Imutável
```
