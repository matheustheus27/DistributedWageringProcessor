# 05 — Execution & Testing Guide 🚀

## 1. Postman and Insomnia Collections 🔌

To facilitate manual testing and developer onboarding, interactive API collections with embedded endpoint documentation are provided:

- 🟧 **Postman Collection**: [`docs/wagering-api.postman_collection.json`](file:///p:/Git/GitHub/DistributedWageringProcessor/docs/wagering-api.postman_collection.json)
- 🟣 **Insomnia Collection**: [`docs/wagering-api.insomnia_collection.json`](file:///p:/Git/GitHub/DistributedWageringProcessor/docs/wagering-api.insomnia_collection.json)

> [!TIP]
> **Integrated Collection Automation**: Upon executing `1. Create Wallet`, the returned `walletId` is automatically extracted and injected into variables for subsequent requests without manual copying!

---

## 2. Standardized Automation Commands (Makefile & Taskfile)

All test commands run **directly inside the application Docker container** (`docker compose exec app`), requiring no local Bun installation.

### 🏗️ Container Build & Lifecycle (`build:*`)
| Make Command | Task Command | Description |
|---|---|---|
| `make build` | `task build` (or `task up`) | Starts PostgreSQL, LocalStack, Prometheus, Grafana, and 3 app replicas. |
| `make build-no-cache` | `task build:no-cache` | Rebuilds Docker images from scratch without cache and boots containers. |
| `make build-down` | `task build:down` (or `task down`) | Stops and removes all Docker Compose containers. |
| `make build-restart` | `task build:restart` (or `task restart`) | Restarts all cluster instances and services. |

### 🗄️ Database & Migrations (`db:*`)
| Make Command | Task Command | Description |
|---|---|---|
| `make db-migrate` | `task db:migrate` | Applies pending SQL migrations via MikroORM inside container. |
| `make db-rollback` | `task db:rollback` | Rollback the latest applied SQL migration. |

> [!NOTE]
> **Automatic Migration Execution**: When starting containers with `make build` or `task build`, pending SQL migrations are **executed automatically** by an init container (`wagering_migration`) before launching application replicas. Manual commands `make db-migrate` and `make db-rollback` remain available on demand for local development.

### 🧪 Test Suite & Quality Assurance (`test:*`)
| Make Command | Task Command | Description |
|---|---|---|
| `make test` | `task test` | Runs application unit tests (`tests/unit`). |
| `make test-concurrency` | `task test:concurrency` | Runs 50-request parallel balance contention concurrency tests. |
| `make test-chaos` | `task test:chaos` | Runs process crash recovery resilience test (`SIGKILL`). |
| `make test-smoke` | `task test:smoke` | Runs fast E2E smoke test and financial reconciliation check. |
| `make test-load` | `task test:load` | Runs load benchmarking test suite with statistical summary. |
| `make test-all` | `task test:all` | Sequentially executes unit, concurrency, and chaos test suites. |

### 📬 Dead Letter Queue Management (`dlq:*`)
| Make Command | Task Command | Description |
|---|---|---|
| `make dlq-inspect` | `task dlq:inspect` | Inspects messages currently held in the SQS Dead Letter Queue. |
| `make dlq-replay` | `task dlq:replay` | Replays DLQ messages back to the primary SQS queue. |
| `make dlq-purge` | `task dlq:purge` | Purges (clears) all messages from the SQS Dead Letter Queue. |

---

## 3. Operational Dashboards (Grafana & Prometheus)

After launching containers via `task build` or `make build`, access:

- 📊 **Grafana Dashboard**: `http://localhost:3000`
  - **Username**: `admin`
  - **Password**: `admin`
  - **Pre-loaded Dashboard**: *Distributed Wagering Processor Dashboard*
  - **Real-Time Panels**: Processed vs Rejected Wager Rate, Outbox Message Queue Lag, Duplicate Rate, and p95 Latency.
- 🔥 **Prometheus Scraper**: `http://localhost:9090`
- 🏥 **Health Check Readiness (App Instance 1)**: `http://localhost:3001/health/ready`

---

## 4. Automated Load Test (`task test:load`)

The benchmarking script [`scripts/load-test.ts`](file:///p:/Git/GitHub/DistributedWageringProcessor/scripts/load-test.ts) simulates high-concurrency real-time stress against the running containerized application:

```bash
task test:load
```

### Sample Benchmarking Output:
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
