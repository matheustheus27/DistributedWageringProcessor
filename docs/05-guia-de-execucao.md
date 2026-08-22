# 05 — Guia de Execução & Testes 🚀

## 1. Coleções do Postman e Insomnia 🔌

Para facilitar os testes manuais e a homologação por desenvolvedores e QA, disponibilizamos coleções interativas com documentação embutida nos próprios endpoints:

- 🟧 **Postman Collection**: [`docs/wagering-api.postman_collection.json`](file:///p:/Git/GitHub/DistributedWageringProcessor/docs/wagering-api.postman_collection.json)
- 🟣 **Insomnia Collection**: [`docs/wagering-api.insomnia_collection.json`](file:///p:/Git/GitHub/DistributedWageringProcessor/docs/wagering-api.insomnia_collection.json)

> [!TIP]
> **Automação Integrada nas Coleções**: Ao executar a requisição `1. Criar Carteira (Create Wallet)`, o `walletId` é automaticamente extraído da resposta e preenchido para todas as chamadas subsequentes sem necessidade de copiar e colar manual!

---

## 2. Comandos de Automação Padronizados (Makefile & Taskfile)

Todos os comandos de teste executam **diretamente dentro do container Docker da aplicação** (`docker compose exec app`), sem necessidade de instalar o Bun no sistema operacional local.

### 🏗️ Build e Ciclo de Vida dos Containers (`build:*`)
| Comando Make | Comando Task | Descrição |
|---|---|---|
| `make build` | `task build` (ou `task up`) | Sobe PostgreSQL, LocalStack, Prometheus, Grafana e 3 réplicas da aplicação. |
| `make build-no-cache` | `task build:no-cache` | Recontrói as imagens Docker do zero sem utilizar cache e inicia os containers. |
| `make build-down` | `task build:down` (ou `task down`) | Encerra e remove todos os containers Docker Compose. |
| `make build-restart` | `task build:restart` (ou `task restart`) | Reinicia todas as instâncias e serviços do cluster. |

### 🗄️ Banco de Dados e Migrações (`db:*`)
| Comando Make | Comando Task | Descrição |
|---|---|---|
| `make db-migrate` | `task db:migrate` | Aplica as migrações SQL pendentes via MikroORM dentro do container. |
| `make db-rollback` | `task db:rollback` | Reverte a última migração SQL aplicada. |

> [!NOTE]
> **Execução Automática de Migrações**: Ao subir os containers com `make build` ou `task build`, as migrações SQL pendentes são **executadas automaticamente** por um container de inicialização (`wagering_migration`) antes de liberar a subida das réplicas da aplicação. Os comandos manuais `make db-migrate` e `make db-rollback` permanecem disponíveis para controle sob demanda em ambiente de desenvolvimento.

### 🧪 Suíte de Testes e Qualidade (`test:*`)
| Comando Make | Comando Task | Descrição |
|---|---|---|
| `make test` | `task test` | Executa os testes unitários da aplicação (`tests/unit`). |
| `make test-concurrency` | `task test:concurrency` | Executa os testes de corrida de saldo com 50 requisições paralelas. |
| `make test-chaos` | `task test:chaos` | Executa o teste de resiliência e recuperação de crashes (`SIGKILL`). |
| `make test-smoke` | `task test:smoke` | Executa o teste rápido E2E de fumaça e reconciliação financeira. |
| `make test-load` | `task test:load` | Executa o teste de carga e benchmarking com relatório estatístico. |
| `make test-all` | `task test:all` | Executa sequencialmente as suítes de testes unitários, concorrência e chaos. |

### 📬 Gestão de Dead Letter Queue (`dlq:*`)
| Comando Make | Comando Task | Descrição |
|---|---|---|
| `make dlq-inspect` | `task dlq:inspect` | Inspeciona as mensagens atualmente retidas na Dead Letter Queue SQS. |
| `make dlq-replay` | `task dlq:replay` | Reprocessa e reenvia as mensagens da DLQ para a fila principal. |
| `make dlq-purge` | `task dlq:purge` | Purga (apaga) todas as mensagens da Dead Letter Queue SQS. |

---

## 3. Dashboard Operacional (Grafana & Prometheus)

Ao subir os containers com `task build` ou `make build`, acesse:

- 📊 **Grafana Dashboard**: `http://localhost:3000`
  - **Usuário**: `admin`
  - **Senha**: `admin`
  - **Dashboard Pré-carregado**: *Distributed Wagering Processor Dashboard*
  - **Painéis em Tempo Real**: Taxa de Apostas Processadas vs Rejeitadas, Lag de Mensagens na Outbox, Taxa de Duplicatas e Latência p95.
- 🔥 **Prometheus Scraper**: `http://localhost:9090`
- 🏥 **Health Check Readiness (App Instância 1)**: `http://localhost:3001/health/ready`

---

## 4. Teste de Carga Automatizado (`task test:load`)

O script [`scripts/load-test.ts`](file:///p:/Git/GitHub/DistributedWageringProcessor/scripts/load-test.ts) executa estresse de alta concorrência em tempo real contra a aplicação dentro do container:

```bash
task test:load
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
