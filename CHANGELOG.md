# Changelog

All notable changes to CaviNet are recorded here, one section per phase.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] Phase 01: Foundation

### Added
- Repository layout from scope section 14.1: `backend/`, `frontend/`, `ml/`, `models/`, `docs/`, `scripts/`.
- Backend: FastAPI app with settings from environment/.env, SQLAlchemy 2 engine and sessions,
  Alembic with an empty baseline migration, and `GET /api/health` reporting API, database
  and Redis status (HTTP 503 when a component is down).
- Background worker: RQ worker on the `analysis` queue, sharing the backend image.
- `cavinet_ml` package with the `cavinet-ml --version` command and placeholder subpackages
  (io, preprocessing, model, inference, training, evaluation).
- Frontend: React 18 + TypeScript + Vite + Tailwind app shell with React Router, TanStack Query,
  a home page with a live system-status card, a not-found page and the disclaimer footer.
- Docker Compose stack (postgres:16, redis:7, backend, worker, nginx frontend on port 8080 with
  `/api` proxied to the backend) and a Makefile: `up`, `down`, `ps`, `logs`, `test`, `lint`,
  `format`, `install`, `seed`, `fetch-model` (stub), `backup`, `restore`.
- GitHub Actions CI: ruff + pytest (with real PostgreSQL/Redis) for the backend, ruff + pytest
  for `ml`, eslint + prettier + type check + vitest + build for the frontend, and a full-stack
  `make up` health check. Pre-commit configuration.
- Documentation: README, CONTRIBUTING (section 14 workflow), pull request template,
  `docs/TRACEABILITY.md` covering all 55 functional requirements.

### Notes
- The scope document, Kaggle dataset findings and the dataset audit script were added to the
  repository before Phase 1 and are unchanged, apart from the formatter tidying one Python
  snippet in `scripts/README.md`.
