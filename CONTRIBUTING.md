# Contributing to CaviNet

CaviNet is built in **12 phases** (section 15 of
[`docs/scope/CaviNet_Scope_Document_v2.md`](docs/scope/CaviNet_Scope_Document_v2.md)).
Claude Code implements each phase from its prompt; a named team member reviews it
(section 16). The scope document is the source of truth: if code and scope disagree, the
scope wins, or the scope is updated first with supervisor approval.

## Workflow for every phase (section 14.2)

1. **Start:** open a Claude Code session on this repository and paste the phase prompt.
2. **Branch:** work happens on `phase-NN-<name>` (e.g. `phase-02-accounts`), or on the branch the
   Claude Code session assigns. `main` is the stable branch; nobody commits to it directly.
3. **Pull request:** titled `Phase NN — <name>`, using the PR template. Every acceptance criterion
   of the phase is listed as a checkbox, ticked only when verified, with the command and output
   that prove it.
4. **CI must be green:** lint, tests and build for backend, ml and frontend, plus the full-stack
   `make up` check.
5. **Review:** the phase reviewer checks each acceptance criterion. If something fails, they give
   Claude Code a short fix-up prompt listing the failing items; the same PR is updated.
6. **Merge and tag:** squash-merge into `main`, then tag the release (`v0.1`, `v0.2`, …) as listed
   in the phase overview (section 15.1).

## Definition of done (section 14.3)

- All acceptance criteria of the phase are met and evidenced in the PR.
- Automated tests written and passing in CI; no lint errors.
- `CHANGELOG.md` and affected docs updated; `docs/TRACEABILITY.md` maps each implemented FR to its tests.
- No secrets, patient data or dataset files committed.
- PR reviewed, merged into `main` and tagged.

## Rules

- **Never commit** `.env`, passwords, tokens, patient data, DICOM/NIfTI files, dataset archives or
  model weights. `.gitignore` blocks the common cases; check `git status` before committing.
- Keep each phase inside its scope; later phases are not started early.
- Every new behaviour gets automated tests. Requirement IDs (e.g. `FR-04.2`) go in test names or
  docstrings so the traceability table can point at them.
- Commit messages: a short imperative summary line (e.g. "Add patient search endpoint"), a blank
  line, then what changed and why.

## Local commands

```bash
make install     # set up .venv and frontend packages (Python 3.11+, Node 20+)
make test        # backend, ml and frontend tests
make lint        # ruff, eslint, prettier, TypeScript
make format      # auto-format
make up          # run the whole system in Docker at http://localhost:8080
```

Optional: `pip install pre-commit && pre-commit install` runs the linters on every commit.

## Code layout

- `backend/app/api/routes/`: HTTP endpoints (one module per area)
- `backend/app/core/`: settings, database, Redis, security
- `backend/app/models/`: SQLAlchemy models; every schema change needs an Alembic migration in `backend/alembic/versions/`
- `backend/app/services/`: business logic used by the routes and the worker
- `backend/app/workers/`: RQ queue, jobs and the worker entry point
- `ml/cavinet_ml/`: AI pipeline shared by training and the worker (preprocessing must be identical in both)
- `frontend/src/`: `api/` (HTTP clients), `components/`, `pages/`, `routes.tsx`, tests next to the code
