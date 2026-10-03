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
| 1 | Foundation: repository, Docker, CI, app shells | ✅ Done |
| 2 | Accounts, roles, admin users page and audit log | ✅ Done |
| 3 | Patients and the doctor dashboard | ✅ Done |
| 4 | CT upload, de-identification, case timeline and notifications | ✅ Done |
| 5 | AI inference engine and results (with a **demo model** until training is done) | ✅ This version |
| 6–7 | Training toolkit, PDF reports | Planned |
| 8–12 | Model training on the real dataset, integration, optional extras, final release | Planned |

The full plan, requirements and phase prompts are in the scope document:
[`docs/scope/CaviNet_Scope_Document_v2.md`](docs/scope/CaviNet_Scope_Document_v2.md)
(Word version alongside it).

## Quick start (run the system)

**You need:**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/). On a Mac choose the
  version for your chip (Apple silicon for M1/M2/M3/M4); on Windows use WSL2.
- `git` and `make`:
  - Mac: run `xcode-select --install` once in Terminal.
  - Linux: usually already installed.
  - Windows: run the commands inside WSL.
- About 10 GB of free disk space. Nothing else is needed: Python, Node.js and the AI libraries
  all run inside Docker.

```bash
git clone https://github.com/ahmadraza225/CaviNet_V1.git
cd CaviNet_V1
make up
```

Then open **http://localhost:8080**.

The first `make up` downloads and builds everything, including the AI libraries, and trains
the small demo model. This takes several minutes; later starts take seconds.

The repository is private. If `git clone` asks for a password, the easiest route is
[GitHub Desktop](https://desktop.github.com/): sign in, choose **Clone repository**, pick
`CaviNet_V1`, then run `make up` in a terminal opened in that folder. Later, **Fetch origin**
then **Pull** in GitHub Desktop gets new versions; run `make up` again after each update.

### Signing in

- The first `make up` creates `.env` with random secrets and prints the **first administrator's
  sign-in** (`ADMIN_EMAIL` / `ADMIN_PASSWORD`, also stored in `.env`). At first sign-in you must
  choose a new password.
- Admins create doctor and admin accounts on the **Users** page with a temporary password; the
  new user must change it at first sign-in. Forgotten passwords are reset the same way (there is
  no email).
- `make seed` adds a demo doctor (`DEMO_DOCTOR_EMAIL` / `DEMO_DOCTOR_PASSWORD` in `.env`).
- Doctors land on the **Dashboard** and manage records under **Patients**. Administrators have
  no access to patient data (they manage accounts and read the audit log).
- Use made-up patients for demonstrations; never enter real patient data in a test system.

### Trying a scan upload

1. `make demo-scan` writes two synthetic scans (no real patient) to `demo-data/`:
   `synthetic_chest_ct.zip`, which is accepted, and `synthetic_too_few_slices.zip`, which is
   refused with the reason shown.
2. Sign in as the demo doctor, add a made-up patient, then click **Upload CT** (on the
   dashboard or the patient's page) and choose the file.
3. The case page shows the status timeline while the AI pipeline runs (about a minute for the
   synthetic scan). It then shows the result:
   - TB or NTM, the probability of TB, and the confidence with its band (High, Moderate, or Low
     = Inconclusive);
   - an explanation in plain language and the disclaimer;
   - the model's validated performance;
   - a slice viewer.

   The bell in the header shows the notification, and the dashboard counts update.

Uploaded scans are checked (CT, axial, at least 50 slices, slices at most 5 mm apart) and
de-identified before they are stored.

### The AI model and the DEMO banner

- Until the real model is trained (Phase 8), CaviNet uses a **demo model** trained in about a
  minute on synthetic volumes. Its results say nothing about real patients.
- While it is installed, every screen shows **"DEMO MODEL: NOT FOR CLINICAL USE"**, and demo
  results carry a **Demo** badge.
- `make up` installs the demo model automatically when `models/` has no model.
- Once the trained model is published, set `MODEL_URL` (and `MODEL_SHA256`) in `.env`, then run
  `make fetch-model FORCE=1` and `make up`.
- Administrators see the installed model under **Model**: version, training date, demo or
  trained, and test results.
- `make benchmark` times the analysis of a synthetic 300-slice scan on this computer. The
  target is under 3 minutes (NFR-1).
- Accounts lock for 15 minutes after 5 wrong passwords; the web app signs out after 30 minutes
  without activity, and every session ends after 8 hours.

| Command | What it does |
|---|---|
| `make up` | Build and start every service, then wait until healthy |
| `make down` | Stop every service (data is kept) |
| `make ps` / `make logs` | Show service status / follow logs |
| `make seed` | Create the demo doctor account |
| `make demo-scan` | Write synthetic test scans to `demo-data/` for trying uploads |
| `make fetch-model` | Download the model named by `MODEL_URL` in `.env`, or build the demo model (`FORCE=1` replaces an installed model) |
| `make benchmark` | Time the analysis of a synthetic 300-slice scan (needs `make up`) |
| `make backup` | Save the database and stored files to `backups/<timestamp>/` |
| `make restore BACKUP=backups/<timestamp>` | Restore a backup (replaces current data) |

`make up` creates `.env` from `.env.example` with generated secrets (and adds any new settings
to an existing `.env`). Keep `.env` private. To use a different port, set `CAVINET_HTTP_PORT`;
if CaviNet is ever served over HTTPS, set `COOKIE_SECURE=true`.

## Development

**You need:** Python 3.11+, Node.js 20+, and Docker for the full stack. Only needed to change
the code; running CaviNet needs just Docker.

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
| `worker` | RQ (same image as the backend) with the `cavinet_ml` AI pipeline: PyTorch, MONAI, SimpleITK, lungmask | Background analysis: preprocessing, previews, model ensemble |
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
