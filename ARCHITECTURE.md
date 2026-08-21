# ARCHITECTURE.md — Distributed Wagering Processor

This document details the architectural decisions, domain invariants, concurrency model, database schema design, and technical trade-offs of the **Distributed Wagering Processor** for Jungle Gaming.

---

## 1. Visão Geral e Hexagonal Architecture

O sistema adota **Hexagonal Architecture (Ports and Adapters)** orientada a Domain-Driven Design (DDD):

```
                       ┌─────────────────────────────────────────┐
                       │               CORE DOMAIN               │
                       │  Wallet, Money, WagerTransaction,       │
                       │  WalletLedgerEntry, Domain Events       │
                       └───────────────────▲─────────────────────┘
                                           │
                       ┌───────────────────┴─────────────────────┐
                       │            APPLICATION LAYER            │
                       │  ProcessWagerUseCase, OpenWallet,       │
                       │  ReconcileWallet, Repository Ports      │
                       └───────────────────▲─────────────────────┘
                                           │
      ┌────────────────────────────────────┼────────────────────────────────────┐
      │                                    │                                    │
┌─────┴──────────────┐           ┌─────────┴────────────┐           ┌───────────┴──────────┐
│  HTTP Controllers  │           │ SQS Consumer/Poller  │           │ MikroORM Persistence │
│ (NestJS REST API)  │           │  (Inbox/Outbox Queue)│           │ (PostgreSQL Driver)  │
└────────────────────┘           └──────────────────────┘           └──────────────────────┘
```

- **Sem acoplamento ao Framework**: A lógica de domínio (`Money`, `Wallet`, `WagerTransaction`, `WalletLedgerEntry`) não possui importações do NestJS, MikroORM ou AWS SQS.
- **Result<T, E> Monad**: O fluxo da aplicação utiliza uma monad de resultado explícita para evitar o lançamento indevido de exceções em caminhos de negócio esperados.

---

## 2. Correção Financeira e Objeto de Valor (`Money`)

1. **Representação Interna**: Utiliza `Decimal.js` envelopado no Value Object `Money` imutável.
2. **Escala e Precisão**:
   - `amount` é serializado como string decimal com exatamente **2 casas decimais** (`"25.00"`).
   - Rejeição estrita no parser de `NaN`, `Infinity`, strings vazias, notação científica (`1e2`) e mais de 2 casas decimais (`25.505`).
3. **Conflito de Moeda**: Operações entre moedas distintas (`BRL` vs `USD`) lançam `CurrencyMismatchError`.
4. **Ledger Auditável**:
   - Toda alteração de saldo exige um lançamento `WalletLedgerEntry` imutável correspondente.
   - `isBalanced()` valida aritmeticamente se `balanceBefore ± money === balanceAfter` antes da gravação.
   - O saldo da carteira pode ser reconciliado a qualquer momento via `POST /wallets/:id/reconciliation`.

---

## 3. Concorrência e Múltiplas Instâncias

A **unidade de concorrência é a `walletId`**.

### Estratégia de Lock
Para suportar **3+ instâncias concorrentes da aplicação** sem *lost updates* nem saldos negativos:

1. **Pessimistic Row Locking (`SELECT FOR UPDATE`)**:
   Ao iniciar o caso de uso `ProcessWagerUseCase`, a wallet envolvida é bloqueada via `em.findOne(WalletMikroEntity, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE })` dentro do Unit of Work (`em.transactional()`).
2. **PostgreSQL Schema Constraints**:
   - `CONSTRAINT check_non_negative_balance CHECK (balance >= 0)`
   - `CONSTRAINT unique_player_currency UNIQUE (player_id, currency)`
   - `CONSTRAINT unique_idempotency_key UNIQUE (idempotency_key)`
   - `CONSTRAINT unique_inbox_consumer_msg UNIQUE (consumer_name, message_id)`

Essa combinação garante que 50 apostas simultâneas na mesma wallet sejam serializadas no banco de dados, resultando em execução totalmente correta.

---

## 4. Idempotência Persistente e Transactional Outbox / Inbox

### Inbox Pattern (SQS)
Mensagens consumidas do SQS são salvas na tabela `inbox_messages` dentro da transação atômica do banco. Se uma mensagem for entregue duplicada, o consumidor detecta o registro e ignora o reprocessamento. O `ACK` no SQS ocorre **apenas após o commit** no PostgreSQL.

### HTTP Idempotency Key
1. `payloadHash`: Hash SHA-256 do JSON canônico (chaves ordenadas) do payload de negócio.
2. **Replay Idempotente**: Se o `idempotencyKey` já existir e o `payloadHash` for idêntico, retorna exatamente a resposta original com `idempotentReplay: true`.
3. **Conflito de Payload**: Se o `idempotencyKey` for reutilizado com payload diferente, o sistema rejeita com HTTP `409 Conflict`.

### Transactional Outbox
1. Altera saldo, grava ledger, insere transação, grava inbox e grava `OutboxMessage` em uma **única transação SQL atômica**.
2. **Worker Desacoplado**: O `OutboxPollerWorker` lê eventos pendentes usando `SELECT ... FOR UPDATE SKIP LOCKED`, garantindo que múltiplas instâncias da aplicação publiquem eventos no SQS sem duplicação ou travamento.

---

## 5. Referências Fora de Ordem (`PENDING_REFERENCE`)

1. Transações `REFUND` ou `ROLLBACK` cuja transação referenciada ainda não chegou são salvas com status `PENDING_REFERENCE`.
2. O `PendingReferenceWorker` reprocessa periodicamente essas transações com backoff exponencial.
3. Caso a referência não chegue no limite de tempo (TTL de 5 min), a transação é rejeitada com `FailureCode.REFERENCE_NOT_FOUND` e o evento correspondente é publicado.

---

## 6. Decisão de Autenticação

De acordo com a **Seção 2** das diretrizes do desafio, autenticação foi isolada em um contrato de extensão `ProviderIdentityPort` e um `ProviderAuthGuard` NestJS no-op para modo de teste local. Isso preserva 100% do foco nos critérios de avaliação (correção financeira, concorrência, idempotência e mensageria) sem exigir o gerenciamento de senhas artesanais ou complexidade excessiva de IdP no Compose para a bateria de testes.
