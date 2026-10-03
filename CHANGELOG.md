# Changelog

All notable changes to CaviNet are recorded here, one section per phase.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.0] Phase 03: Patients and doctor dashboard

### Added
- **Patients (FR-03.1):** full name, hospital MR number (unique; stored trimmed and
  upper-case, so `mr-1001` and `MR-1001` are the same), date of birth, sex, optional phone and
  notes. The same rules are checked in the browser and on the server, and each message is shown
  next to its field.
- **Patient management (FR-03.2):** doctors create, view, edit and delete patients. Deleting is
  permanent and must be confirmed by typing the patient's MR number; it removes the patient's
  folder `DATA_DIR/patients/<id>/`, and the database cascades to the scans, results and reports
  that later phases attach to the patient.
- **Patient list (FR-03.3):** search by part of the name or MR number (any case), sort by name,
  MR number, date of birth, date added or last update, 20 per page. Search, sort and page are
  kept in the address, so Back and shared links work.
- **Patient page (FR-03.4):** demographics, Edit and Delete, and a Scans section (empty until
  Phase 4) with the Upload CT button.
- **Doctor dashboard (FR-02.1 to FR-02.3):** doctors now land on a dashboard with the five counts
  (total patients; scan and case counts stay 0 until Phase 4), a recent-cases table (empty until
  Phase 4), a patient search box and an **Upload CT** button that is visible but disabled with
  the tooltip "Available in a later phase". Navigation for doctors: Dashboard, Patients.
- **Doctor only (section 9.3):** every patient and dashboard endpoint answers 403 to admins, and
  the web app shows them "No access". Admins keep Home, Users and Audit log.
- **Audit (FR-09.2):** patient created, edited (with the names of the changed fields) and deleted.
  Entries identify the patient by record id only, never by name or MR number.
- API: `GET/POST /api/patients`, `GET/PATCH/DELETE /api/patients/{id}` (`DELETE` needs
  `?confirm=<MR number>`), `GET /api/dashboard/stats`, `GET /api/dashboard/recent-cases`.
- Alembic migration `0003` (patients).

### Changed
- Privacy (NFR-3): the backend and nginx access logs no longer record query strings, because
  patient searches put names and MR numbers in the address.
- SQLite (used by the tests) now enforces foreign keys, so cascade deletes behave as on
  PostgreSQL.
- Alembic keeps the application's loggers when migrations run inside the test process.
- Version 0.3.0.

### Upgrade notes
- Run `make up`: the backend applies migration `0003` on start. No `.env` changes.

## [0.2.0] Phase 02: Accounts, roles and administration

### Added
- **Sign-in (FR-01.1, FR-01.2):** email + password, Argon2id hashing, password policy (10+
  characters with a letter and a digit), 30-minute access tokens (JWT, kept in memory by the
  browser) and an 8-hour refresh token in an httpOnly, SameSite=Strict cookie scoped to
  `/api/auth`. Refresh tokens rotate on use; reusing a rotated token ends all of that user's
  sessions. Sign-out revokes the refresh token.
- **Roles (FR-01.3):** Doctor and Admin. Every endpoint uses a `require_roles(...)` dependency;
  only `/api/health` and `/api/auth/{login,refresh,logout}` are public. A test discovers every
  endpoint and fails if one lacks a role check (401 without a token, 403 for the wrong role).
- **Lockout (FR-01.4):** 5 failed sign-ins lock the account for 15 minutes.
- **Inactivity sign-out (FR-01.5):** the web app signs out after 30 minutes without interaction.
- **Temporary passwords (FR-01.6):** admins set temporary passwords; until the user changes it,
  every endpoint except their own account endpoints answers 403 `password_change_required`.
  Changing a password ends the user's other sessions and invalidates older access tokens.
- **First admin (FR-01.7):** created on first start from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, and
  must change the password at first sign-in.
- **Administration (FR-09.1):** list, create, rename/assign role, deactivate/reactivate and
  reset passwords. Admins cannot change their own role or deactivate themselves.
- **Audit log (FR-09.2, FR-09.3):** sign-in success/failure, account locked, sign-out, password
  changes and every user-management action, with actor, target, client address and time (never
  passwords or medical content); filter by user (actor or target), action and date range, with
  pagination. Request-context middleware supplies the client address.
- Web app: sign-in page, change-password page, protected routes, role-based navigation (admin:
  Home, Users, Audit log; doctor: Home), Users page and Audit log page.
- `make seed` creates the demo doctor (`DEMO_DOCTOR_EMAIL` / `DEMO_DOCTOR_PASSWORD`).
- `make env` / `make up` generate `.env` with a random `SECRET_KEY`, database password and
  starting passwords, and add new settings to an existing `.env` without changing old values.
- Alembic migration `0002` (users, refresh_tokens, audit_logs); a PostgreSQL test checks the
  migrations match the models (`alembic check`).
- CI full-stack job now signs in as the generated admin and the seeded doctor and checks the
  doctor gets 403 from the admin API.

### Changed
- Backend container trusts nginx's `X-Forwarded-For` (the backend port is not published), so
  the audit log records the client address.
- Version 0.2.0.

### Upgrade notes
- Run `make up` (or `make env`): it adds `SECRET_KEY`, `ADMIN_*`, `DEMO_DOCTOR_*` and
  `COOKIE_SECURE` to an existing `.env` and prints the first admin's sign-in.

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
