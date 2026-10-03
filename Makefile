# CaviNet developer and operator commands. Run `make help` for the list.
SHELL := /bin/bash

COMPOSE ?= docker compose
PYTHON ?= python3
VENV ?= .venv
VENV_BIN := $(VENV)/bin

-include .env
CAVINET_HTTP_PORT ?= 8080
HEALTH_URL := http://localhost:$(CAVINET_HTTP_PORT)/api/health

.DEFAULT_GOAL := help

.PHONY: help up down logs ps install test test-backend test-ml test-frontend \
        lint lint-python lint-frontend format seed fetch-model backup restore

help: ## Show this list of commands
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

.env:
	cp .env.example .env
	@echo "Created .env from .env.example. Change POSTGRES_PASSWORD before real use."

## ---- Running the system (needs Docker) ----

up: .env ## Build and start every service, then wait until healthy
	$(COMPOSE) up -d --build
	@./scripts/wait_for_health.sh $(HEALTH_URL) 300
	@echo "Open http://localhost:$(CAVINET_HTTP_PORT)"

down: ## Stop every service (data is kept)
	$(COMPOSE) down

logs: ## Follow the logs of every service
	$(COMPOSE) logs -f

ps: ## Show service status
	$(COMPOSE) ps

seed: ## Load demo data (demo accounts arrive in Phase 2)
	$(COMPOSE) exec backend python -m app.seed

fetch-model: ## Download the trained model (stub until Phase 5)
	@echo "fetch-model: not available yet. Phase 5 adds model download and the demo model."

backup: ## Back up the database and stored files into backups/
	./scripts/backup.sh

restore: ## Restore a backup: make restore BACKUP=backups/<timestamp>
	./scripts/restore.sh "$(BACKUP)"

## ---- Development (needs Python 3.11+ and Node 20+) ----

install: ## Create .venv with backend + ml dev dependencies and install frontend packages
	$(PYTHON) -m venv $(VENV)
	$(VENV_BIN)/pip install --upgrade pip
	$(VENV_BIN)/pip install -e "./ml[dev]" -e "./backend[dev]"
	cd frontend && npm ci

test: test-backend test-ml test-frontend ## Run every automated test

test-backend: ## Backend tests (integration tests need TEST_DATABASE_URL and TEST_REDIS_URL)
	cd backend && ../$(VENV_BIN)/pytest

test-ml: ## ML package tests
	cd ml && ../$(VENV_BIN)/pytest

test-frontend: ## Frontend tests
	cd frontend && npm test

lint: lint-python lint-frontend ## Run every linter and format check

lint-python:
	$(VENV_BIN)/ruff check backend ml scripts
	$(VENV_BIN)/ruff format --check backend ml scripts

lint-frontend:
	cd frontend && npm run lint && npm run format:check && npm run typecheck

format: ## Auto-format Python and frontend code
	$(VENV_BIN)/ruff check --fix backend ml scripts
	$(VENV_BIN)/ruff format backend ml scripts
	cd frontend && npm run format
