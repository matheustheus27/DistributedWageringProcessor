# 03 — Mensageria, SQS FIFO & Outbox Pattern 📬

## 1. Estrutura das Mensagens SQS

As mensagens são enviadas para a fila SQS FIFO `wager-transactions.fifo` utilizando o atributo `MessageGroupId = walletId` e `MessageDeduplicationId = idempotencyKey`.

```json
{
  "messageId": "msg-123-abc",
  "type": "WagerTransactionRequested",
  "occurredAt": "2026-08-21T15:00:00.000Z",
  "correlationId": "corr-uuid-999",
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

---

## 2. Padrão Inbox & Confirmação (ACK) Pós-Commit

Para garantir resiliência contra falhas no consumidor SQS:

1. **Deduplicação de Mensagem**: O `SqsConsumerService` intercepta o `messageId` e consulta a tabela `inbox_messages` pela chave composta `PRIMARY KEY (consumer_name, message_id)`.
2. **Processamento Atômico**: O processamento do caso de uso e a gravação da `InboxMessage` ocorrem dentro de uma única transação SQL.
3. **ACK Pós-Commit**: O comando `DeleteMessage` (ACK) é emitido para o SQS **exclusivamente após a transação SQL ter feito COMMIT**.
4. **Resiliência a Quedas (Crash Recovery)**: Se o servidor morrer antes do ACK, o SQS reentrega a mensagem. Ao chegar novamente no consumidor, o registro em `inbox_messages` previne duplicidade de débitos e emite o ACK limpo.

---

## 3. Transactional Outbox Worker

O worker `OutboxPollerWorker` é responsável por ler os eventos gravados na tabela `outbox_messages` e publicá-los na fila SQS:

- **Locking Distribuído Segura (`SKIP LOCKED`)**:
  ```sql
  SELECT * FROM outbox_messages
  WHERE published_at IS NULL
    AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
  ORDER BY occurred_at ASC
  FOR UPDATE SKIP LOCKED;
  ```
- **Suporte a Multi-Instâncias**: Múltiplos workers em containers diferentes nunca travam nem publicam a mesma mensagem simultaneamente.
- **Backoff Exponencial**: Em caso de falha de publicação no SQS, o worker incrementa `attempts` e calcula o próximo envio via `scheduleRetry()`.

---

## 4. Gestão e Reprocessamento de DLQ

Mensagens que esgotam o limite de tentativas de consumo são movidas para a Dead Letter Queue (`wager-transactions-dlq.fifo`).

Disponibilizamos comandos utilitários via CLI para operações na DLQ:

```bash
# Inspecionar mensagens na DLQ
bun run dlq:inspect  # ou 'make dlq-inspect' / 'task dlq:inspect'

# Reprocessar (Replay) mensagens da DLQ para a fila principal
bun run dlq:replay   # ou 'make dlq-replay' / 'task dlq:replay'

# Purgar/Limpar a DLQ
bun run dlq:purge    # ou 'task dlq:purge'
```
