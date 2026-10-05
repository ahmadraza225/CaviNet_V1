# CaviNet developer guide

How CaviNet is built, how to run and test it while changing it, and the rules every change
follows. For installing it on a laptop see [DEPLOYMENT.md](DEPLOYMENT.md); for the Git workflow
per phase see [CONTRIBUTING.md](../CONTRIBUTING.md); for training the model see
[TRAINING_RUNBOOK.md](TRAINING_RUNBOOK.md). The requirements (FR-xx.y, NFR-n) are defined in
[the scope document](scope/CaviNet_Scope_Document_v2.md), which wins over this guide.

## Contents

1. [Architecture](#1-architecture)
2. [What happens to an uploaded scan](#2-what-happens-to-an-uploaded-scan)
3. [Repository layout](#3-repository-layout)
4. [Setting up a development computer](#4-setting-up-a-development-computer)
5. [Running the pieces](#5-running-the-pieces)
6. [Tests](#6-tests)
7. [Backend conventions](#7-backend-conventions)
8. [Frontend conventions](#8-frontend-conventions)
9. [The AI package (`cavinet_ml`)](#9-the-ai-package-cavinet_ml)
10. [Privacy and security rules](#10-privacy-and-security-rules)
11. [Continuous integration](#11-continuous-integration)
12. [Releasing a version](#12-releasing-a-version)
13. [Recipes](#13-recipes)

## 1. Architecture

Five Docker Compose services ([`docker-compose.yml`](../docker-compose.yml)):

```text
 browser ──HTTP──▶ frontend (nginx, port 8080)
                    ├── /        React single-page app (static files)
                    └── /api/*  ──▶ backend (FastAPI, uvicorn :8000) ──▶ postgres (data)
                                         │                         └─▶ /data volume (scans, previews)
                                         └── enqueue ──▶ redis (RQ queue) ──▶ worker (RQ + cavinet_ml)
                                                                                 ├─▶ postgres
                                                                                 ├─▶ /data volume
                                                                                 └─▶ /models (AI model bundle, read-only)
```

| Service | Image | Role |
|---|---|---|
| `frontend` | `frontend/Dockerfile`: Node 20 builds the app, nginx 1.27 serves it | Static files, security headers (CSP), `/api` reverse proxy, upload size limits |
| `backend` | `backend/Dockerfile`: Python 3.11, CPU PyTorch, `cavinet_ml`, the API | REST API; runs `alembic upgrade head` on start |
| `worker` | same image as `backend` | `python -m app.workers.run`: RQ worker running the analysis pipeline |
| `postgres` | `postgres:16` | Database (volume `postgres_data`) |
| `redis` | `redis:7` | RQ job queue (append-only file, volume `redis_data`) |

Only nginx publishes a port. Data lives in three named volumes: `postgres_data`, `redis_data`
and `app_data` (mounted at `/data`). The model bundle is the host folder `models/`, mounted
read-only.

## 2. What happens to an uploaded scan

1. **Upload** (`POST /api/patients/{id}/cases`, `api/routes/cases.py`): the multipart body is
   streamed to `DATA_DIR/staging/<random id>/` chunk by chunk (`services/uploads.py`); nothing
   is held in memory, and file names are used only for their extension. nginx and the backend
   both enforce the 1.5 GB limit (FR-04.1).
2. **Case created**, status `uploaded` (`services/cases.py: create_case`), then
   `validating`: `services/dicom_intake.py` reads .zip files with limits on the number of
   entries and the expanded size, reads the DICOM headers, picks the series with the most
   slices, applies the rules of FR-04.2 (CT, axial, ≥ 50 slices, ≤ 5 mm spacing, equal sizes) and **de-identifies**
   every slice (FR-04.4) into `DATA_DIR/cases/<case id>/dicom/`. The staging folder is deleted.
   A rule failure raises `ScanRejected`; its plain-language `reason` is shown to the doctor.
3. **Queued**: the case id is put on the RQ queue (`enqueue_analysis`). Steps 1 to 3 happen
   within the upload request.
4. **Worker** (`workers/analysis.py`): `preprocessing` (load the series, lungmask segmentation
   with a body-mask fallback, section 11.1 preprocessing, 48 preview PNGs), then `analysing`
   (the 5-model ensemble, temperature calibration, decision and confidence band), then
   `completed` with an `analysis_results` row, or `failed` with a reason. One automatic retry
   on temporary errors (FR-05.5). A notification goes to the uploader (FR-08.2).
5. **Reading the result**: `GET /api/cases/{id}/result`, previews from
   `/api/cases/{id}/previews/{n}`, the PDF from `/api/cases/{id}/report` (built on demand with
   ReportLab by `services/report.py`, never stored). Viewing and downloading are audited.

Status changes go through `set_status`, which enforces the allowed moves of FR-08.1 and
writes the timeline. Completed and Failed are final.

## 3. Repository layout

```text
backend/
  app/
    api/deps.py          current_user, require_roles, DoctorUser/AdminUser, DbSession
    api/routes/          one module per area: auth, admin, patients, cases, dashboard,
                         notifications, model, health
    core/                settings (config.py), database, redis, security (hashing, JWT),
                         logging (no identifiers), request context, cache headers, clock
    models/              SQLAlchemy 2 models; every change needs an Alembic migration
    schemas/             Pydantic request/response models
    services/            business logic used by routes and the worker (one module per area)
    workers/             RQ queue, job functions, the analysis pipeline, worker entry point
    seed.py              demo doctor (make seed);  synthetic_dicom.py: synthetic scans
    benchmark.py         NFR-1 timing (make benchmark)
  alembic/versions/      migrations 0001… (numbered, one per schema change)
  tests/                 pytest: unit + API tests on SQLite, integration tests on PostgreSQL/Redis
frontend/
  src/api/               typed API calls; client.ts: fetch wrapper, token refresh, errors
  src/auth/              AuthProvider (session, inactivity timeout), RequireAuth, password rules
  src/components/        shared UI (ui.tsx: Alert, Button, Loading, fields), header, bell, result
  src/pages/             one folder per area; routes.tsx maps URLs to pages and roles
  src/test/              test helpers: renderRoute, mockApi, fixtures, fake XHR
ml/
  cavinet_ml/            the AI package: io, preprocessing, model, inference, previews,
                         analysis (Analyser), demo model, fetch, dataset/training/evaluation (M-10)
  configs/               training configuration (train.yaml)
  tests/                 pytest
e2e/                     Playwright journey of section 9.2 (make e2e)
scripts/                 init_env, wait_for_health, backup/restore, dataset audit
docs/                    scope, manuals, runbooks, traceability, audits, images
```

## 4. Setting up a development computer

You need **Python 3.11+**, **Node.js 20+**, **Docker** (for the full stack) and `make`.

```bash
make install     # .venv with backend + ml (dev, train extras); frontend npm packages
make test        # backend, ml and frontend tests
make lint        # ruff, eslint, prettier, TypeScript
make format      # auto-format Python and frontend code
```

`make install` installs the CPU build of PyTorch first (`TORCH_INDEX_URL`). Optional:
`pip install pre-commit && pre-commit install` runs the linters on every commit.

Tooling: **ruff** (lint + format, line length 100) for Python; **ESLint**, **Prettier** and
**TypeScript** (strict) for the frontend and `e2e/`.

## 5. Running the pieces

| Goal | How |
|---|---|
| Whole system as users see it | `make up`, then http://localhost:8080 |
| Rebuild after a backend or frontend change | `make up` (rebuilds changed images) |
| Frontend with hot reload | Run the stack (`make up`), then `cd frontend && VITE_API_PROXY=http://localhost:8080 npm run dev` and open http://localhost:5173: the app reloads as you edit, and `/api` goes to the running stack (without `VITE_API_PROXY` it goes to an API on port 8000) |
| API docs | http://localhost:8080/api/docs (OpenAPI) |
| Logs | `make logs`, or `docker compose logs -f worker` |
| A shell in the backend | `docker compose exec backend bash` |
| The database | `docker compose exec postgres psql -U cavinet cavinet` |
| Test data | `make seed`, `make demo-scan` |
| Time a 300-slice analysis | `make benchmark` |

## 6. Tests

| Suite | Command | Notes |
|---|---|---|
| Backend | `make test-backend` (or `.venv/bin/pytest backend`) | API tests use FastAPI's TestClient on a temporary SQLite database and a fake queue |
| Backend integration | set `TEST_DATABASE_URL` and `TEST_REDIS_URL`, then `make test-backend` | Real PostgreSQL and Redis; CI always runs them (`test_integration.py`) |
| ML | `make test-ml` | Includes a full synthetic training run on CPU (Phase 6) |
| Frontend | `make test-frontend` (or `cd frontend && npx vitest`) | Vitest + Testing Library; `renderRoute()` renders the real app at a URL; `mockApi()` fakes `fetch` per `"METHOD /path"` |
| End-to-end | `make up`, then `make e2e` | Playwright drives Chromium through the section 9.2 journey against the running stack, checks the PDF, fails on any CSP violation; screenshots in `e2e/test-results/screenshots/` |
| User manual screenshots | `make manual-screenshots` on a fresh stack | Re-captures `docs/images/manual/` (needs `pdftoppm` for the report page) |

Rules:

- Every new behaviour gets tests. Put the requirement ID (`FR-04.2`, `NFR-3`) in the test name
  or docstring, and add the test to [TRACEABILITY.md](TRACEABILITY.md).
- `tests/test_role_coverage.py` discovers every API route: a new endpoint without a role
  dependency (and not in `PUBLIC_PATHS`) fails the suite, its roles must match the matrix of
  section 9.3, and each route is called with the wrong role to check the 403.
- Never use real patient data in tests or fixtures; synthetic scans come from
  `app/synthetic_dicom.py` or `cavinet_ml.demo`.

## 7. Backend conventions

- **Layers**: routes parse input, check the role and call a service; services hold the logic
  and raise errors from `services/errors.py` (`InvalidInput`, `NotFound`, `Forbidden`,
  `Conflict`, …), which become JSON `{detail, code}` answers. Routes do not build SQL.
- **Roles (FR-01.3)**: protect every route with a dependency from `api/deps.py`, usually on
  the router: `APIRouter(..., dependencies=[Depends(require_doctor)])`, and take the user as
  `doctor: DoctorUser` or `admin: AdminUser`. Administrators never see patient data.
- **Audit (FR-09.3)**: call `audit.record(db, AuditAction.X, actor=..., target_type=...,
  target_id=..., details=...)` in the same transaction as the change; the caller commits.
  Details never contain names, MR numbers, file names or passwords; patients and cases appear
  by id. Add new actions to `AuditAction` and their labels to
  `frontend/src/pages/admin/auditLabels.ts`.
- **Settings**: `core/config.py` (Pydantic settings from the environment / `.env`); add new
  settings to `.env.example` with a comment so `make up` adds them to existing installs.
- **Database changes**: edit the model, then add a migration in `backend/alembic/versions/`
  with the next number (`0006_<what>.py`), following the existing files. To let Alembic draft
  it, use a throwaway PostgreSQL (the stack's database port is not published):

  ```bash
  docker run --rm -d --name cavinet-pg-dev -p 5433:5432 -e POSTGRES_PASSWORD=dev postgres:16
  cd backend
  export DATABASE_URL=postgresql+psycopg://postgres:dev@localhost:5433/postgres
  ../.venv/bin/alembic upgrade head
  ../.venv/bin/alembic revision --autogenerate -m "short description"
  docker stop cavinet-pg-dev
  ```

  Review the draft, check `alembic upgrade head` and `alembic downgrade -1`, and add tests.
  The backend applies migrations when it starts.
- **Time**: use `core/clock.utcnow()` (timezone-aware UTC); the frontend shows local time.
- **Files**: only through `services/storage.py`; paths use random ids, never identifiers.
- **Logging**: `core/logging.py` keeps identifiers out of logs (query strings are stripped).
  Log ids, never names, MR numbers or file names.

## 8. Frontend conventions

- **Data fetching**: TanStack Query. API functions live in `src/api/<area>.ts` and call
  `apiFetch` (JSON) or `apiFetchBlob` (files) from `client.ts`, which adds the access token,
  renews it once on a 401, and turns every failure into an `ApiError` with a message a doctor
  can read (validation messages per field, plain text for network and server errors).
- **States**: every query shows `<Loading>` while pending, an `<Alert tone="error">` with the
  error's message on failure, and a sentence saying what to do when a list is empty. A route
  that throws shows `ErrorPage` (set as `errorElement` on every route).
- **Routes and roles**: `routes.tsx`; `RequireAuth` requires a session and `RequireRole`
  guards each area (doctors: dashboard, patients, upload, cases; admins: users, audit log,
  model). The backend checks
  roles again; the frontend check only hides pages.
- **Styling**: Tailwind utility classes; shared pieces in `components/ui.tsx`. Pages must work
  at 1280 px wide (NFR-5) and be usable with a keyboard and screen reader: real labels,
  `role="alert"` / `role="status"` for messages, `aria-label` on lists the tests query.
- **Content Security Policy**: nginx sends `script-src 'self'`; no inline scripts or styles,
  no external resources. The e2e test fails on any CSP violation.
- **Tests**: query by role and accessible name (`getByRole("button", { name: "Upload scan" })`),
  as a user would.

## 9. The AI package (`cavinet_ml`)

One package serves the application (inference) and the training toolkit (M-10), so training
and analysis preprocess identically.

- **`Analyser`** (`analysis.py`): `prepare(dicom_dir, preview_dir)` loads the series, segments
  the lungs (lungmask R231, weights baked into the image; body-mask fallback with a warning),
  preprocesses per section 11.1 and writes the previews; `infer(prepared)` runs the ensemble
  and returns probability, class, confidence, band and explanation.
- **Model bundle** (section 11.6): one `.pth` file with the 5 fold models, temperature,
  threshold, confidence bands, preprocessing parameters, metadata and validated metrics.
  `model/bundle.py` loads and checks it; `fetch.py` downloads it (`make fetch-model`) or builds
  the demo bundle (`demo/`), which is flagged `is_demo` and makes the app show the DEMO
  banners.
- **CLI**: `cavinet-ml --help`. Training commands are in [TRAINING_RUNBOOK.md](TRAINING_RUNBOOK.md).
- The application runs on CPU only. MONAI ≥ 1.6 reads the user name on import, so containers
  run as a user unknown to the image need `USER` set (see `make fetch-model`).

## 10. Privacy and security rules

These are requirements (NFR-2, NFR-3), not preferences:

- **No real patient data, DICOM/NIfTI files, dataset archives, model weights, backups or `.env`
  in git.** `.gitignore` blocks the usual cases; check `git status` before every commit.
- Stored scans are de-identified (FR-04.4). Names and MR numbers live only in the `patients`
  table. They never go into file paths, logs, audit details, job arguments or URLs kept in logs.
- Passwords: Argon2id hashes only, policy in `core/security.py` (≥ 10 characters, a letter and a
  digit); 5 failures lock an account for 15 minutes.
- Sessions: short-lived JWT access tokens in memory (never in localStorage) and an HttpOnly
  refresh cookie; 30-minute inactivity sign-out and an 8-hour absolute limit; changing or
  resetting a password ends existing sessions.
- nginx sends the security headers (CSP, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, COOP) and no version number; API answers carry
  `Cache-Control: no-store`. CI checks them.
- Dependencies are scanned in CI (`pip-audit`, `npm audit`); fix or document every finding.

## 11. Continuous integration

`.github/workflows/ci.yml` runs on every pull request:

| Job | What it checks |
|---|---|
| Backend (ruff + pytest) | Lint, format, the traceability table, unit/API tests, integration tests against PostgreSQL and Redis services; fails below 70% line coverage (NFR-7) |
| ML package (ruff + pytest) | Lint, tests including the synthetic end-to-end training pipeline (report kept as an artifact); fails below 70% line coverage |
| Frontend (eslint + vitest + build) | Lint, format, type check, tests, production build |
| Dependency vulnerability scan | `pip-audit` and `npm audit` |
| Full stack (make up + health check) | `make up` from a fresh checkout; health, security headers and size limits through nginx; sign-in and roles; patient CRUD and log privacy; a synthetic scan analysed to completion; the **Playwright journey** (screenshots, PDF and report kept as the `e2e-journey` artifact); a **backup, delete, restore** round trip; the 300-slice timing (NFR-1) |

A PR is merged only when every job is green.

## 12. Releasing a version

1. Bump the version in `backend/pyproject.toml`, `backend/app/__init__.py`,
   `ml/pyproject.toml`, `ml/cavinet_ml/__init__.py` and `frontend/package.json` (then
   `cd frontend && npm install --package-lock-only`).
2. Add the release notes to `CHANGELOG.md` and update `docs/TRACEABILITY.md`.
3. After the squash-merge, the reviewer tags `main` (e.g. `v0.9-demo`) and creates the GitHub
   Release.

## 13. Recipes

**Add an API endpoint**

1. Schema in `schemas/`, logic in `services/` (raise the errors from `services/errors.py`).
2. Route in `api/routes/<area>.py` with the right role dependency; register new routers in
   `main.py`.
3. `audit.record(...)` if it changes data or reveals medical content.
4. Tests: behaviour, validation, wrong role (the role-coverage test adds the 403 check), audit
   entry. Add the FR to TRACEABILITY.md.

**Add a page**

1. API function in `src/api/`, page in `src/pages/<area>/`, route in `routes.tsx` under the
   right `RequireRole`, link in `navigation.ts` if it belongs in the header.
2. Loading, error and empty states (section 8).
3. Tests with `renderRoute("/your/path")` and `mockApi({...})`.

**Change the model's preprocessing or decision rules**

Change `cavinet_ml` and its tests, then retrain, or rebuild the demo bundle with
`make fetch-model FORCE=1`. Each bundle carries the preprocessing parameters it was trained
with, and the analysis uses those, so an existing bundle keeps analysing as it was trained
until it is replaced.
