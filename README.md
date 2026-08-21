# 🦧 Processador Financeiro Distribuído de Apostas — Jungle Gaming

Bem-vindo ao repositório do **Distributed Wagering Processor**! Este projeto foi desenvolvido para o desafio técnico de Backend Developer da **Jungle Gaming**.

---

## 💡 Entendendo o Problema (Sem Complicação!)

Imagine que você está jogando em um cassino online. Você faz uma aposta de **R$ 25,00**. Nesse exato milissegundo:
1. O jogo avisa o sistema: *"Debite R$ 25,00 do jogador X"*.
2. A sua conexão de internet oscila e o jogo reenvia a mesma mensagem **3 vezes**.
3. Ao mesmo tempo, você abriu o jogo em outra aba e tentou apostar mais **R$ 80,00**, mas seu saldo inicial era de apenas **R$ 100,00**.

**O que um sistema financeiro de verdade NÃO pode deixar acontecer?**
- ❌ Não pode descontar a mesma aposta 3 vezes (Idempotência).
- ❌ Não pode deixar o saldo ficar negativo (Consistência Financeira).
- ❌ Não pode perder a conta ou calcular centavos errado (Precisão Decimal).
- ❌ Não pode travar nem dar erro se tiverem 10.000 pessoas jogando juntas (Concorrência & Resiliência).

Este projeto é a solução para esse problema: um **microserviço financeiro distribuído**, resiliente a falhas e pronto para rodar em produção em múltiplos servidores simultâneos.

---

## 🔄 Fluxo de Dados e Transacionalidade Atômica

O diagrama abaixo ilustra o ciclo de vida completo de uma transação de aposta, desde a chegada da requisição até a persistência atômica no banco e a publicação assíncrona do evento:

```mermaid
sequenceDiagram
    autonumber
    actor Provider as Provedor / Cliente
    participant API as Controller / SQS Consumer
    participant UseCase as ProcessWagerUseCase
    participant DB as PostgreSQL Database
    participant OutboxWorker as Outbox Worker
    participant SQS as SQS FIFO Queue

    Provider->>API: POST /wagering/transactions (HTTP ou SQS)
    API->>UseCase: execute(ProcessWagerCommand)
    
    note over UseCase, DB: 🔒 Transação Atômica SQL (em.transactional)
    UseCase->>DB: 1. SELECT ... FOR UPDATE (Lock na Wallet)
    UseCase->>DB: 2. Inserir InboxMessage (Deduplicação)
    UseCase->>DB: 3. Validar Idempotência (payloadHash SHA-256)
    UseCase->>DB: 4. Validar Regra de Saldo (Saldo >= Valor)
    UseCase->>DB: 5. Debitar/Creditar Wallet & Inserir LedgerEntry
    UseCase->>DB: 6. Inserir WagerTransaction (PROCESSED / REJECTED)
    UseCase->>DB: 7. Inserir OutboxMessage (Evento de Integração)
    DB-->>UseCase: Commit Confirmado

    UseCase-->>API: Result.ok(ProcessWagerResponse)
    API-->>Provider: Resposta HTTP 200 OK / SQS ACK (DeleteMessage)

    note over OutboxWorker, SQS: ⚡ Polling Assíncrono Desacoplado
    OutboxWorker->>DB: SELECT FOR UPDATE SKIP LOCKED (Mensagens Pendentes)
    OutboxWorker->>SQS: Publish Event (WagerTransactionProcessed)
    OutboxWorker->>DB: UPDATE outbox_messages SET published_at = NOW()
```

---

## 🌟 Recursos Avançados de Engenharia Produção-Ready

1. **⚡ Suite Automatizada de Testes de Carga (`bun run test:load`)**: Script de benchmarking simulando cenários de *Hot Wallet* (100 requisições simultâneas na mesma conta) e injeção massiva de duplicatas.
2. **💥 Chaos Engineering & Resiliência (`bun run test:chaos`)**: Teste de integração automatizado simulando queda de processo (`SIGKILL`) pós-commit.
3. **📊 Double-Entry Bookkeeping (Partidas Dobradas)**: Lançamentos contábeis balanceados entre `PLAYER_LIABILITY`, `HOUSE_PLATFORM` e `PROVIDER_SETTLEMENT`.
4. **🔍 Context Logging & Telemetria**: `AsyncLocalStorage` nativo propagando `correlationId`, `walletId` e `traceId` automaticamente em logs JSON Pino.
5. **📥 Gestão de DLQ CLI (`bun run dlq:inspect` / `bun run dlq:replay`)**: Ferramenta de inspeção e reprocessamento de mensagens da Dead Letter Queue.
6. **⚙️ CI/CD Pipeline (GitHub Actions)**: Workflows automatizados em `.github/workflows/ci.yml`.
7. **☸️ Manifestos Kubernetes Produção-Ready (`k8s/`)**: Deployment com HPA de 3-10 réplicas, ConfigMap, Service e Liveness/Readiness probes.
8. **🔨 Makefile & Taskfile de Automação**: Atalhos multiplataforma (`make up` / `task up`, `make test` / `task test`, `make test-load` / `task test:load`).

---

## 🚀 Como Rodar o Projeto

### Usando Taskfile ou Makefile (Recomendado)
```bash
task up         # Ou 'make up' -> Sobe PostgreSQL, LocalStack, Prometheus e Grafana
task test       # Ou 'make test' -> Executa testes unitários
task test:load  # Ou 'make test-load' -> Executa teste de carga e benchmarking
```

### Usando Docker Compose
```bash
docker compose up --build --scale app=3
```

---

## 📂 Organização do Código (Estrutura de Diretórios)

```
DistributedWageringProcessor/
├── 📁 .github/                         # Workflows de Integração Contínua (CI/CD)
│   └── 📁 workflows/
│       └── ⚙️ ci.yml                    # Pipeline GitHub Actions (Build, Migrações, Testes)
├── 📁 src/                             # Código-fonte da aplicação (Hexagonal Architecture)
│   ├── 📁 core/                        # Núcleo compartilhado DDD (Domain primitives, Result, Errors)
│   │   ├── 📁 application/             # Monad funcional Result<T, E>
│   │   ├── 📁 domain/                  # ValueObject e AggregateRoot base
│   │   └── 📁 errors/                  # Hierarquia AppError, DomainError e FailureCode enum
│   ├── 📁 modules/                     # Módulos de Domínio da Aplicação
│   │   ├── 📁 messaging/               # 📬 Transacional Outbox & Inbox
│   │   │   ├── 📁 application/         # Contratos de repositório Inbox e Outbox
│   │   │   ├── 📁 domain/              # Entities InboxMessage, OutboxMessage e IntegrationEvents
│   │   │   └── 📁 infrastructure/      # Repositórios MikroORM, SQS Producer/Consumer e Poller Worker
│   │   ├── 📁 wagering/                # 🎲 Gestão de Apostas & Transações
│   │   │   ├── 📁 application/         # Use Cases (ProcessWagerUseCase, GetWagerTransactionUseCase)
│   │   │   ├── 📁 domain/              # Entity WagerTransaction, Estados e Regras por Kind
│   │   │   └── 📁 infrastructure/      # Controller HTTP, DTOs e PendingReferenceWorker
│   │   └── 📁 wallet/                  # 👛 Gestão de Carteiras & Ledger Auditável
│   │       ├── 📁 application/         # Use Cases (OpenWallet, GetWallet, GetLedger, ReconcileWallet)
│   │       ├── 📁 domain/              # Wallet Aggregate Root, Money Value Object, WalletLedgerEntry
│   │       └── 📁 infrastructure/      # Controller HTTP, DTOs, Entidades e Repositórios MikroORM
│   ├── 📁 shared/                      # Infraestrutura compartilhada da aplicação
│   │   ├── 📁 application/             # Contrato IUnitOfWork
│   │   └── 📁 infrastructure/          # Database UnitOfWork, Migrações SQL, AsyncLocalStorage, Telemetria e Health
│   └── 📄 main.ts                      # Ponto de entrada NestJS com Bootstrapping e Pipes
├── 📁 tests/                           # Suíte de Testes Automatizados
│   ├── 📁 unit/                        # Testes unitários (Money, Wallet, WagerTransaction)
│   ├── 📁 integration/                 # Testes de integração e Chaos Engineering (chaos.test.ts)
│   └── 📁 concurrency/                 # Testes de concorrência e consistência financeira
├── 📁 scripts/                         # Scripts de Automação & Load Test
│   ├── 📜 load-test.ts                 # Script de benchmarking e estresse de carga (bun run test:load)
│   ├── 📜 dlq-management.ts            # CLI de inspeção e replay de DLQ (bun run dlq:replay)
│   └── 📜 init-localstack.sh           # Auto-provisionamento de Filas FIFO SQS no LocalStack
├── 📁 k8s/                             # Manifestos Produção-Ready Kubernetes
│   ├── 📄 configmap.yaml               # Configurações do Cluster K8s
│   ├── 📄 deployment.yaml              # Deployment com 3 réplicas e Liveness/Readiness probes
│   ├── 📄 hpa.yaml                     # HorizontalPodAutoscaler (3-10 pods)
│   └── 📄 service.yaml                 # ClusterIP Service
├── 📁 docker/                          # Configurações de Monitoramento
│   ├── 📁 grafana/                     # Provisionamento de Dashboards Grafana
│   └── 📜 prometheus.yml               # Configuração do Prometheus Metrics Scraper
├── 📋 Taskfile.yml                     # Automação de tarefas multiplataforma (Task)
├── 🔨 Makefile                         # Comandos de automação GNU Make (make up, test, load)
├── 🐳 docker-compose.yml              # Orquestração de Containers (Postgres, LocalStack, App, Prometheus, Grafana)
├── 🐳 Dockerfile                       # Containerização usando Bun 1.x Alpine
├── ⚙️ commitlint.config.js             # Padronização de Conventional Commits
├── ⚙️ mikro-orm.config.ts             # Configuração ORM, conexão PostgreSQL e Migrações
├── 📜 package.json                    # Dependências da aplicação e scripts de execução Bun
├── 📄 tsconfig.json                   # Configuração estrita do TypeScript e Path Aliases (@core, @modules)
├── 📖 README.md                       # Documentação didática do projeto
├── 📐 ARCHITECTURE.md                 # Documento detalhado de decisões arquiteturais, C4 e banco de dados
└── 🔒 .env.example                    # Modelo de variáveis de ambiente
```

---

## 📑 Quer se aprofundar na Arquitetura Técnica?

Para entender em detalhes o desenho das tabelas no PostgreSQL, os diagramas de estado C4, o funcionamento do **Transactional Outbox**, OpenTelemetry e os resultados dos benchmarks:

👉 **[Leia o ARCHITECTURE.md](/ARCHITECTURE.md)**
