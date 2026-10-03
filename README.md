# CaviNet

**AI decision support for differentiating pulmonary tuberculosis (TB) from
non-tuberculous mycobacterial (NTM) lung disease on chest CT.**

A doctor uploads a patient's chest CT scan and CaviNet reports whether it looks more like
**TB** or **NTM**, with a calibrated confidence score and a PDF report. The AI model is a 3D
convolutional neural network trained on 1,301 public chest CT scans.

Final Year Project, Department of Computer Science, Air University Islamabad (2025–2027).

> **Disclaimer.** CaviNet is a research prototype for decision support only. It is **not a
> diagnosis** and not a medical device. TB and NTM must be confirmed with laboratory tests.

## Project status

| Phase | Content | Status |
|---|---|---|
| 1 | Foundation: repository, Docker, CI, app shells | ✅ This version |
| 2–7 | Accounts, patients, CT upload, AI inference, training toolkit, reports | Planned |
| 8–12 | Model training on the real dataset, integration, optional extras, final release | Planned |

The full plan, requirements and phase prompts are in the scope document:
[`docs/scope/CaviNet_Scope_Document_v2.md`](docs/scope/CaviNet_Scope_Document_v2.md)
(Word version alongside it).

## Quick start (run the system)

**You need:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (on Windows,
with WSL2) and `make` (built into macOS/Linux; on Windows run the commands inside WSL).

```bash
git clone https://github.com/ahmadraza225/CaviNet_V1.git
cd CaviNet_V1
make up
```

Then open **http://localhost:8080**. The first `make up` downloads and builds everything
(a few minutes); later starts take seconds. The page's *System status* card should show
every service as **Working**.

| Command | What it does |
|---|---|
| `make up` | Build and start every service, then wait until healthy |
| `make down` | Stop every service (data is kept) |
| `make ps` / `make logs` | Show service status / follow logs |
| `make seed` | Load demo data (demo accounts arrive in Phase 2) |
| `make fetch-model` | Download the trained model (available from Phase 5) |
| `make backup` | Save the database and stored files to `backups/<timestamp>/` |
| `make restore BACKUP=backups/<timestamp>` | Restore a backup (replaces current data) |

On first run `make up` creates `.env` from `.env.example`. Change `POSTGRES_PASSWORD` there
before storing real data. To use a different port, set `CAVINET_HTTP_PORT`.

## Development

**You need:** Python 3.11+, Node.js 20+, and Docker for the full stack.

```bash
make install   # .venv with backend + ml dev dependencies, frontend packages
make test      # all automated tests
make lint      # all linters and format checks
make format    # auto-format code
```

Backend integration tests run against real PostgreSQL and Redis when `TEST_DATABASE_URL` and
`TEST_REDIS_URL` are set (CI always runs them). For the frontend dev server, run the API on
port 8000 and `cd frontend && npm run dev` (http://localhost:5173, `/api` is proxied).

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the phase-by-phase Git workflow.

## Architecture

| Service | Technology | Role |
|---|---|---|
| `frontend` | React 18 + TypeScript + Vite + Tailwind, served by nginx | Web app on port 8080; proxies `/api` to the backend |
| `backend` | Python 3.11, FastAPI, SQLAlchemy 2, Alembic | REST API (`/api/...`, docs at `/api/docs`) |
| `worker` | RQ (same image as the backend) | Background analysis jobs |
| `postgres` | PostgreSQL 16 | Database |
| `redis` | Redis 7 | Job queue |

```
backend/    FastAPI app (api, core, models, services, workers), Alembic migrations, tests
frontend/   React app, components, pages, tests
ml/         cavinet_ml package: AI pipeline and training toolkit (`cavinet-ml` CLI)
models/     Downloaded model bundle (git-ignored)
docs/       Scope document, traceability, audits and (later) manuals and reports
scripts/    Utility scripts: health wait, backup/restore, dataset audit
```

## Dataset

CaviNet is trained on the **Mycobacterial CT Imaging Dataset** (Tianjin Haihe Hospital), published
as *"An Integrated Mycobacterial CT Imaging Dataset with Multispecies Information"*, Scientific
Data (2025), and distributed on Kaggle as
[`damianhan/dicom-dataset`](https://www.kaggle.com/datasets/damianhan/dicom-dataset) under the
[Creative Commons Attribution 4.0 (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
licence. Dataset files are never stored in this repository. Findings from our dataset
investigation are in [`docs/audit/`](docs/audit/).

## Team

Mahnoor Iqbal (230910), Khudema Haroon (232942), Ahmed Raza (230958).
Supervisor: Sohaib Masood · Co-supervisor: Kanwal Ejaz.
Implementation: Claude Code, phase by phase, reviewed by the team.
