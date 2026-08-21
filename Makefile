.PHONY: help up down restart test test-unit test-concurrency test-chaos test-load migrate dlq-inspect dlq-replay

help:
	@echo "=========================================================================="
	@echo "🦧 Distributed Wagering Processor — Developer Automation Commands"
	@echo "=========================================================================="
	@echo "  make up               - Start PostgreSQL, LocalStack, Prometheus & Grafana"
	@echo "  make down             - Stop all Docker Compose services"
	@echo "  make restart          - Restart all containers"
	@echo "  make migrate          - Run PostgreSQL MikroORM database migrations"
	@echo "  make test             - Run all unit tests"
	@echo "  make test-concurrency - Run real 50-request parallel concurrency tests"
	@echo "  make test-chaos       - Run chaos engineering process recovery tests"
	@echo "  make test-load        - Run automated benchmarking and load test suite"
	@echo "  make dlq-inspect      - Inspect SQS Dead Letter Queue messages"
	@echo "  make dlq-replay       - Replay DLQ messages back to main queue"
	@echo "=========================================================================="

up:
	docker compose up --build --scale app=3 -d

down:
	docker compose down

restart:
	docker compose restart

migrate:
	bun run migration:up

test:
	bun run test

test-concurrency:
	bun run test:concurrency

test-chaos:
	bun run test:chaos

test-load:
	bun run test:load

dlq-inspect:
	bun run dlq:inspect

dlq-replay:
	bun run dlq:replay
