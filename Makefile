# CaviNet developer and operator commands. Run `make help` for the list.
SHELL := /bin/bash

COMPOSE ?= docker compose
PYTHON ?= python3
VENV ?= .venv
VENV_BIN := $(VENV)/bin

-include .env
CAVINET_HTTP_PORT ?= 8080
TORCH_INDEX_URL ?= https://download.pytorch.org/whl/cpu
HEALTH_URL := http://localhost:$(CAVINET_HTTP_PORT)/api/health

.DEFAULT_GOAL := help

.PHONY: help env up down logs ps install test test-backend test-ml test-frontend \
        lint lint-python lint-frontend format seed demo-scan fetch-model benchmark backup restore

help: ## Show this list of commands
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

env: ## Create .env with generated secrets, or add settings new in .env.example
	@./scripts/init_env.sh

## ---- Running the system (needs Docker) ----

up: env ## Build and start every service (and the AI model on first run), then wait
	$(COMPOSE) build
	@[ -f models/cavinet_model.pth ] || $(MAKE) --no-print-directory fetch-model
	$(COMPOSE) up -d
	@./scripts/wait_for_health.sh $(HEALTH_URL) 300
	@echo "Open http://localhost:$(CAVINET_HTTP_PORT)"

down: ## Stop every service (data is kept)
	$(COMPOSE) down

logs: ## Follow the logs of every service
	$(COMPOSE) logs -f

ps: ## Show service status
	$(COMPOSE) ps

seed: ## Create the demo doctor account (DEMO_DOCTOR_EMAIL / DEMO_DOCTOR_PASSWORD in .env)
	$(COMPOSE) exec backend python -m app.seed

demo-scan: ## Write synthetic test CT scans (no real patient) to demo-data/ for trying uploads
	@mkdir -p demo-data
	$(COMPOSE) exec -T backend python -m app.synthetic_dicom --size 512 > demo-data/synthetic_chest_ct.zip
	$(COMPOSE) exec -T backend python -m app.synthetic_dicom --slices 30 > demo-data/synthetic_too_few_slices.zip
	@echo "Wrote demo-data/synthetic_chest_ct.zip (accepted) and"
	@echo "      demo-data/synthetic_too_few_slices.zip (rejected: fewer than 50 slices)."

fetch-model: ## Download the model named by MODEL_URL in .env, or build the demo model
	$(COMPOSE) run --rm --no-deps --user "$$(id -u):$$(id -g)" -e HOME=/tmp \
	  -e CAVINET_GIT_COMMIT="$$(git rev-parse --short HEAD 2>/dev/null || echo unknown)" worker \
	  cavinet-ml fetch-model --out /models/cavinet_model.pth $(if $(FORCE),--force,)
	@echo "The worker picks up a new model file automatically for the next scan."

benchmark: ## Time the full analysis of a synthetic 300-slice scan on this computer's CPU
	$(COMPOSE) exec worker python -m app.benchmark --slices 300

backup: ## Back up the database and stored files into backups/
	./scripts/backup.sh

restore: ## Restore a backup: make restore BACKUP=backups/<timestamp>
	./scripts/restore.sh "$(BACKUP)"

## ---- Development (needs Python 3.11+ and Node 20+) ----

install: ## Create .venv with backend + ml dev dependencies and install frontend packages
	$(PYTHON) -m venv $(VENV)
	$(VENV_BIN)/pip install --upgrade pip
	$(VENV_BIN)/pip install --index-url $(TORCH_INDEX_URL) "torch>=2.3,<3"
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
