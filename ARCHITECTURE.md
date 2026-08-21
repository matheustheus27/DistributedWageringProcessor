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

## 3. Design do Banco de Dados & Constraints Invioláveis

As regras de consistência financeira e idempotência são garantidas no próprio schema do PostgreSQL:

### `wallets`
- `balance NUMERIC(18, 2) NOT NULL CHECK (balance >= 0)`
- `UNIQUE (player_id, currency)`
- `version INT NOT NULL DEFAULT 1`

### `wallet_ledger_entries`
- `CHECK (balance_after >= 0)`
- `CHECK (balance_before + (CASE WHEN direction = 'CREDIT' THEN amount ELSE -amount END) = balance_after)`
- **Imutabilidade Estrutural**: Permissões de `INSERT` apenas (sem `UPDATE`/`DELETE`).

### `wager_transactions`
- `UNIQUE (provider_id, idempotency_key)`
- `UNIQUE (provider_id, external_transaction_id)`
- Índice Parcial de Pendências:
  ```sql
  CREATE INDEX idx_pending_reference ON wager_transactions (status, created_at)
  WHERE status = 'PENDING_REFERENCE';
  ```

### `inbox_messages`
- Chave Primária Composta: `PRIMARY KEY (consumer_name, message_id)`

### `outbox_messages`
- Índice Parcial de Polling:
  ```sql
  CREATE INDEX idx_outbox_pending ON outbox_messages (published_at, next_attempt_at)
  WHERE published_at IS NULL;
  ```

---

## 4. Estratégia de Concorrência e Transacionalidade

Para evitar *lost updates* sob alto paralelismo em múltiplas instâncias:

1. **Pessimistic Locking com Timeout**: O processamento de cada transação bloqueia a linha da carteira via `SELECT ... FOR UPDATE` ordenado pelo `wallet_id`.
2. **Canonical Payload Hash**: Validação de idempotência via SHA-256 de chaves JSON ordenadas.
   - **Hash idêntico**: Retorna o estado persistido (`idempotentReplay: true`).
   - **Hash divergente**: Lança `IdempotencyConflictError` (HTTP 409).
3. **Atomic Transaction Boundary**: Dentro de uma única transação gerenciada pelo `EntityManager.transactional()` do MikroORM:
   1. Leitura bloqueante da Wallet;
   2. Gravação/atualização do registro de `InboxMessage`;
   3. Persistência da `WagerTransaction`;
   4. Atualização do saldo da `Wallet` e inserção na `WalletLedgerEntry`;
   5. Inserção do evento encapsulado na `OutboxMessage`.

---

## 5. Referências Fora de Ordem (`PENDING_REFERENCE`)

1. Transações `REFUND` ou `ROLLBACK` cuja transação referenciada ainda não chegou são salvas com status `PENDING_REFERENCE`.
2. O `PendingReferenceWorker` reprocessa periodicamente essas transações com backoff exponencial via índice `idx_pending_reference`.
3. Caso a referência não chegue no limite de tempo (TTL de 5 min), a transação é rejeitada com `FailureCode.REFERENCE_NOT_FOUND` e o evento correspondente é publicado.

---

## 6. Decisão de Autenticação

De acordo com a **Seção 2** das diretrizes do desafio, autenticação foi isolada em um contrato de extensão `ProviderIdentityPort` e um `ProviderAuthGuard` NestJS no-op para modo de teste local. Isso preserva 100% do foco nos critérios de avaliação (correção financeira, concorrência, idempotência e mensageria) sem exigir o gerenciamento de senhas artesanais ou complexidade excessiva de IdP no Compose para a bateria de testes.
