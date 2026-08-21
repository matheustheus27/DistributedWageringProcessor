# 05 — Guia de Execução & Testes 🚀

## 1. Comandos de Automação (Makefile & Taskfile)

Disponibilizamos comandos utilitários para acelerar o fluxo de desenvolvimento:

| Comando Make | Comando Task | Descrição |
|---|---|---|
| `make up` | `task up` | Sobe PostgreSQL, LocalStack, Prometheus, Grafana e 3 réplicas da aplicação. |
| `make down` | `task down` | Para todos os containers Docker Compose. |
| `make migrate` | `task migrate` | Aplica as migrações SQL no banco PostgreSQL via MikroORM. |
| `make test` | `task test` | Executa os testes unitários (`bun test tests/unit`). |
| `make test-concurrency` | `task test:concurrency` | Executa os testes de concorrência real (50 requisições simultâneas). |
| `make test-chaos` | `task test:chaos` | Executa o teste de resiliência e crash pós-commit (`chaos.test.ts`). |
| `make test-load` | `task test:load` | Executa o teste de carga e benchmarking com relatório estatístico. |
| `make dlq-inspect` | `task dlq:inspect` | Inspeciona as mensagens atualmente retidas na Dead Letter Queue. |
| `make dlq-replay` | `task dlq:replay` | Reprocessa e reenvia as mensagens da DLQ para a fila principal. |

---

## 2. Dashboard Operacional (Grafana & Prometheus)

Ao subir os containers com `make up` ou `docker compose up --scale app=3`, acesse:

- 📊 **Grafana Dashboard**: `http://localhost:3001`
  - **Usuário**: `admin`
  - **Senha**: `admin`
  - **Dashboard Pré-carregado**: *Distributed Wagering Processor Dashboard*
  - **Painéis em Tempo Real**: Taxa de Apostas Processadas vs Rejeitadas, Lag de Mensagens na Outbox, Taxa de Duplicatas e Latência p95.
- 🔥 **Prometheus Scraper**: `http://localhost:9090`
- 🏥 **Health Check Readiness**: `http://localhost:3000/health/ready`

---

## 3. Teste de Carga Automatizado (`bun run test:load`)

O script [`scripts/load-test.ts`](file:///p:/Git/GitHub/DistributedWageringProcessor/scripts/load-test.ts) executa estresse de alta concorrência em tempo real contra a aplicação:

```bash
bun run test:load
```

### Exemplo de Saída do Benchmarking:
```
=================================================
📊 LOAD TEST METRICS & BENCHMARK SUMMARY 📊
=================================================
Total Requests Sent : 100
Duration            : 0.42s
Throughput (RPS)    : 238.10 req/sec
Successful Debits   : 100
Idempotent Replays  : 0
Conflicts (409)     : 0
Failed Requests     : 0
Latency p50         : 15 ms
Latency p95         : 38 ms
Latency p99         : 52 ms
=================================================
Reconciliation result: Consistent = true, Stored = 9000.00, Calculated = 9000.00
✅ FINANCIAL CONSISTENCY VERIFIED 100% PERFECT!
```
