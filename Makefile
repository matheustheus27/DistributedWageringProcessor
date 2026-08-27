.PHONY: help env-ensure build build-no-cache build-down build-restart up down restart db-migrate db-rollback test test-unit test-concurrency test-chaos test-smoke test-load test-all dlq-inspect dlq-replay dlq-purge

help:
	@echo "=========================================================================="
	@echo "  Distributed Wagering Processor — Developer Automation Commands"
	@echo "=========================================================================="
	@echo "  make build            - Build and start PostgreSQL, LocalStack, Prometheus & Grafana"
	@echo "  make build-no-cache   - Rebuild Docker images from scratch without cache"
	@echo "  make build-down       - Stop all Docker Compose services"
	@echo "  make build-restart    - Restart all containers"
	@echo "  make db-migrate       - Run PostgreSQL MikroORM database migrations"
	@echo "  make test             - Run unit tests inside container"
	@echo "  make test-concurrency - Run real 50-request parallel concurrency tests"
	@echo "  make test-chaos       - Run chaos engineering process recovery tests"
	@echo "  make test-smoke       - Run E2E smoke test inside container"
	@echo "  make test-load        - Run automated benchmarking and load test suite"
	@echo "  make test-all         - Run all test suites (unit, concurrency, chaos)"
	@echo "  make dlq-inspect      - Inspect SQS Dead Letter Queue messages"
	@echo "  make dlq-replay       - Replay DLQ messages back to main queue"
	@echo "  make dlq-purge        - Purge SQS Dead Letter Queue messages"
	@echo "=========================================================================="

env-ensure:
	@if [ ! -f .env ]; then cp .env.example .env && echo ".env auto-created from .env.example"; fi

# --- Container Build & Lifecycle ---
build: env-ensure
	docker compose up --build --scale app=3 -d

build-no-cache: env-ensure
	docker compose build --no-cache
	docker compose up --scale app=3 -d

build-down:
	docker compose down

build-restart:
	docker compose restart

# --- Convenience Aliases ---
up: build
down: build-down
restart: build-restart

# --- Database & Migrations ---
db-migrate:
	docker compose exec app bun run migration:up

db-rollback:
	docker compose exec app bun run migration:down

# --- Tests & Quality Assurance ---
test:
	docker compose exec app bun test tests/unit

test-unit:
	docker compose exec app bun test tests/unit

test-concurrency:
	docker compose exec app bun test tests/concurrency

test-chaos:
	docker compose exec app bun test tests/integration/chaos.test.ts

test-smoke:
	docker compose exec app bun scripts/smoke-test.ts

test-load:
	docker compose exec app bun scripts/load-test.ts

test-all: test-unit test-concurrency test-chaos

# --- SQS Dead Letter Queue (DLQ) Management ---
dlq-inspect:
	docker compose exec app bun scripts/dlq-management.ts inspect

dlq-replay:
	docker compose exec app bun scripts/dlq-management.ts replay

dlq-purge:
	docker compose exec app bun scripts/dlq-management.ts purge
