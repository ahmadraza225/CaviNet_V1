# Changelog

All notable changes to CaviNet are recorded here, one section per phase.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.6.0] Phase 06: Training and evaluation toolkit

### Added
- **Training toolkit (M-10, FR-10.1 to FR-10.8): the `cavinet-ml` commands**, run from the
  repository root on the GPU computer. Everything they write goes to `work/` (git-ignored),
  except `ml/splits.json` and the reports in `docs/`.
  - `index` (FR-10.1): reads the Kaggle zip or its folder plus `PatientIndex.xlsx` and writes
    `work/manifest.csv`: case ID, label (from the folder, cross-checked with the sheet), age,
    sex, the 12 symptoms, slices, slice thickness and spacing, manufacturer, kernel, compression
    and notes. Only DICOM headers are read; nothing is extracted. Patient folders are found by
    name (`TB/TB_xxx`, `NTM/Case_xxx`); the series with the most slices is described.
  - `PatientIndex.xlsx` parser: finds the header row, ignores legend rows ("Gender 1:Male
    2:Female"), reads blank or space-only cells as absent, and reports rather than guesses
    patients listed twice with different values.
  - `preprocess` (FR-10.2): section 11.1 with the Phase 5 code, one patient at a time (only
    that patient's files leave the zip), in parallel worker processes, with lungmask on the GPU
    when there is one. Output: float16 volumes in `work/cache/`, a QC report (status, failure
    reason, fallback warnings, lung volume, crop size, input mean) and a QC image per patient.
    Resumable: re-running skips finished patients (`--retry-failed` for failures). A cache made
    with other section 11.1 parameters is refused.
  - `split` (FR-10.3, section 11.3): locked 20% test set and 5 folds, stratified by label ×
    sex × age band × manufacturer, seed 42; largest-remainder allocation gives exactly 20% and
    proportional strata. Writes `ml/splits.json` (case IDs only) and refuses to overwrite it.
  - `train --fold k` (FR-10.4, section 11.4), configured by `ml/configs/train.yaml` (every
    section 11.4 value; unknown keys and invalid values are refused):
    - BCE with logits, pos_weight = #NTM/#TB of the fold;
    - AdamW with 3 warm-up epochs then cosine;
    - batch 4, mixed precision and gradient accumulation to 16; on CUDA out-of-memory the batch
      is halved (keeping 16) and the epoch restarts from the last checkpoint;
    - training-only augmentation on the GPU (flip, ±10° rotation, 0.9–1.1 scaling, ±8 voxel
      translation, ±10% intensity, noise σ 0.01);
    - early stopping on validation AUC (patience 12), best and last checkpoints, automatic
      resume, CSV and TensorBoard logs, training curves, the saved configuration and provenance
      (git commit, manifest and split hashes, GPU), and the best model's out-of-fold logits;
    - MedicalNet ResNet-18 weights when available (via MONAI, or a downloaded file), otherwise
      training from scratch; the outcome is recorded in the model card.
  - `calibrate` (FR-10.5): temperature scaling on the out-of-fold logits of every development
    patient, with per-fold and pooled AUC, Brier score and calibration error.
  - `export` (FR-10.6): the section 11.6 bundle (saved and checked with the Phase 5 code),
    `model_card.json` and `docs/MODEL_CARD.md` (intended use, data, preprocessing, training,
    calibration, performance, limitations). A model built from synthetic data is always
    `is_demo`.
  - `evaluate --split dev|test` (FR-10.7, section 11.7): AUC, sensitivity, specificity, PPV,
    NPV, accuracy, balanced accuracy, F1, Brier score and expected calibration error, each with
    a stratified-bootstrap 95% CI (2,000 resamples); ROC curve, confusion matrix, reliability
    diagram, metrics at the Youden threshold chosen on the development set, subgroup AUCs (sex,
    age band, manufacturer), the clinical baseline and the DeLong test, the shortcut check, and
    H1/H2 stated as supported or not. Results: `docs/EVALUATION_REPORT.md` and `docs/figures/`.
    The test split runs **once**: every run is logged in `docs/audit/evaluation_runs.jsonl`
    and a second run is refused unless `--force` is given with `--reason`. The locked-test
    results are then written into the bundle (weights unchanged, checked by their SHA-256) and
    the model card.
  - `baseline`, `shortcut-check`, `compare` (FR-10.8): clinical-only (age, sex, 12 symptoms)
    and metadata-only (manufacturer, kernel, slice thickness) logistic regressions on exactly
    the CT model's folds, and DeLong comparisons of two models on the same patients.
  - `synthetic-dataset`: a small synthetic look-alike of the Kaggle dataset (zip, uncompressed
    DICOM, `PatientIndex.xlsx` with legend rows and the real file's quirks). No patient data.
- **`docs/TRAINING_RUNBOOK.md`**: GPU computer setup (Ubuntu 22.04 or Windows 11 + WSL2, NVIDIA
  driver, CUDA PyTorch), Kaggle token, download and checksum, disk space, every command in
  order with expected times, the test-set checklist, troubleshooting, Kaggle's free GPU as a
  last resort, and publishing the model as a GitHub Release.
- `make install-train` (toolkit environment, CUDA PyTorch) and `make rehearsal` (every command
  on the synthetic dataset, including a check that a second test evaluation is refused).
- Tests for every toolkit module, and an end-to-end test running the whole chain through the
  CLI (2 folds × 1 epoch on CPU, full-size network) whose bundle is then analysed by the
  application's `Analyser`. CI installs the training extra and keeps the synthetic report,
  figures and model card as a downloadable artifact.

### Changed
- Patients without exactly one row in `PatientIndex.xlsx` are kept in the manifest but left out
  of the split, with the reason: their label cannot be cross-checked (section 7.3) and the
  clinical baseline would lack them. In the published file these are Case_226 and Case_227 (not
  listed) and Case_252 and Case_253 (listed twice with different ages and species).
- The lungmask segmenter can run on the GPU (`force_cpu=False`, used only by the toolkit; the
  application stays on the CPU) and its R231 weights can be downloaded with a checksum.
- `roc_auc` uses SciPy ranks (faster, same results); `threshold_metrics` also returns PPV, NPV,
  balanced accuracy and F1.
- The `ml` package has a `train` extra for the toolkit's libraries (pandas, openpyxl,
  scikit-learn, PyYAML, matplotlib, TensorBoard, pydicom, huggingface_hub); the application
  image does not install it.
- Version 0.6.0.

### Notes
- The toolkit has only been run on synthetic data; the real dataset is processed in Phase 8.
  The `PatientIndex.xlsx` parser was checked against the structure of the real file.
- The repository is private, so `make fetch-model` cannot yet download a release asset without
  a login; the runbook explains the manual step until Phase 9.

## [0.5.0] Phase 05: AI inference engine and results

### Added
- **`cavinet_ml` AI pipeline (M-05).** The worker uses it now, and Phase 6 training will use
  the same code.
  - `io.dicom.load_series`: reads the stored series with SimpleITK/GDCM, including
    JPEG-Lossless compressed scans, in Hounsfield units, sorted by slice position and oriented
    LPS. A damaged slice is an error, not silently skipped.
  - `preprocessing` (section 11.1):
    - clip below -1024 HU;
    - lung mask with lungmask R231, falling back to the body outline (with a warning) when it
      finds no lungs or less than 500 mL;
    - resample to 1.5 mm isotropic (linear for the image, nearest neighbour for the mask);
    - crop to the lung box plus 10 mm;
    - lung window -1350 to 150 HU scaled to 0–1;
    - trilinear resize to 128 × 128 × 128, stored as float16.

    Each step is a separate, tested function, and the settings are stored in the model bundle.
  - `model` (section 11.2): MONAI 3D ResNet-18 with one input channel, dropout 0.3 and one
    logit. Bundles follow section 11.6:
    - float16 weights for every fold, temperature, threshold, confidence bands, preprocessing,
      label map, metrics, git commit and `is_demo`;
    - written atomically and loaded with `torch.load(weights_only=True)`;
    - files that are not valid bundles are refused.
  - `inference` (section 11.5):
    - the fold logits are averaged, then divided by the temperature and passed through a
      sigmoid;
    - TB if p ≥ 0.50;
    - confidence is p for TB and 1 − p for NTM, rounded to 0.1% before the band is chosen;
    - bands: High from 80.0%, Moderate from 65.0%, otherwise Low ("Inconclusive");
    - each result gets a plain-language explanation;
    - temperature fitting is also included, for Phase 6.
  - `previews`: 48 evenly spaced axial slices over the lungs, head to feet, plus 3
    representative slices, as lung-window PNGs at most 512 px wide (FR-05.3).
  - `demo`: synthetic volumes (TB-like upper-lobe cavities, NTM-like scattered nodules) and
    `build_demo_bundle`, which trains a small 5-fold ResNet-18 in about a minute on CPU and
    marks the bundle `is_demo = true` (FR-05.6).
  - `cavinet-ml fetch-model` downloads `MODEL_URL` (checking `MODEL_SHA256` when set) and keeps
    a valid installed model. With no URL, or if the download fails, it builds the demo bundle.
    `model_card.json` is written beside the bundle.
- **Worker (FR-04.6, FR-05.1 to FR-05.5).**
  - The Phase 4 stub is gone: the worker preprocesses the scan, writes the previews and runs
    the ensemble.
  - It records:
    - model name and version;
    - probability and confidence;
    - total processing time and time per step;
    - lung volume;
    - warnings, such as the fallback crop.
  - Failures:
    - a scan that cannot be read fails at once with the reason;
    - an unexpected error is retried once, then the case fails with a clear message;
    - no installed model, or an unreadable one, fails the case and says what to do.
  - On start-up the worker resumes an analysis that a restart interrupted, once.
  - The model is loaded once per worker process, and the lungmask R231 weights are part of the
    Docker image, checked by SHA-256 at build time and never downloaded at runtime.
- **Results (M-06, FR-06.1 to FR-06.4).**
  - `GET /api/cases/{id}/result` returns:
    - predicted class, probability of TB, confidence and band, explanation;
    - the disclaimer "Decision support only. Not a diagnosis. Confirm with laboratory tests.";
    - validated performance (test AUC, sensitivity, specificity) from the model card;
    - the model, warnings and timings.
  - `GET /api/cases/{id}/previews/{index}` serves the slice images. Both endpoints are
    doctor-only.
  - The case page shows all of this, with a slice viewer (slider plus Up/Down buttons).
- **Demo model banner (FR-05.6, NFR-9).**
  - "DEMO MODEL: NOT FOR CLINICAL USE" appears on every screen while the installed model is the
    demo, on the result itself, and as a **Demo** badge next to demo results on the dashboard
    and patient pages.
  - When no model is installed, every screen says so.
  - `GET /api/model/status` serves this to any signed-in user.
- **Admin model page (FR-09.4).** **Model** in the admin menu shows:
  - name, version, training date, demo or trained;
  - locked-test and cross-validation metrics;
  - temperature, threshold and bands;
  - preprocessing settings;
  - file name, size and SHA-256.

  Served by `GET /api/admin/model`.
- **Audit (FR-09.2):** opening a result records `result_viewed`, with the case id only.
- `make fetch-model` installs the model into `models/` (run automatically by `make up` when
  no model is installed; `FORCE=1` replaces it). `make benchmark` times the analysis of a
  synthetic 300-slice scan in the running worker.
- Alembic migration `0005` (result columns on cases).
- **CI:**
  - The ml job runs the real lungmask test with the cached R231 weights.
  - The full-stack job checks that a synthetic upload completes with a TB/NTM result, the demo
    flag and banner, and 48 previews.
  - It also times a 300-slice scan on the CI CPU.

### Changed
- Synthetic scans now have lungs that shrink towards both ends, like a real chest, so
  lungmask finds them. `make demo-scan` writes a 512 × 512 scan (a realistic 36 cm field of
  view), so the demo analysis needs no fallback crop.
- lungmask runs in batches of 2 slices: as fast on CPU as its default of 20, with a fraction
  of the memory (a 300-slice scan peaked at 4.5 GB before, 2.2 GB now).
- The backend image installs CPU-only PyTorch (`TORCH_INDEX_URL` can point elsewhere when the
  PyTorch index is unreachable).
- nginx looks the backend up through Docker's DNS on every request (cached 10 s). Before, after
  an update that recreated only the backend container, the web app answered "502 Bad Gateway"
  until the frontend was restarted too.
- Version 0.5.0.

### Removed
- The Phase 4 stub analyser and `STUB_STEP_SECONDS`. Cases analysed by the stub keep their
  "STUB" label and are shown as placeholders.

### Notes
- **Deviation from section 11.1, step 3:** lungmask takes about 0.75 s per slice on CPU, so
  on thin-slice scans it segments slices at most 3 mm apart, and each skipped slice uses the
  mask of the nearest segmented slice (`lungmask_max_slice_gap_mm`, stored in the bundle).
  This keeps a 300-slice scan within the 3-minute target (NFR-1). Training in Phase 6 uses
  the same setting, so training and inference stay identical.
- **NFR-1 timing:** `make benchmark` analysed a synthetic 300-slice 512 × 512 scan in 50 s
  on a 4-core development CPU, using real lungmask and the demo model (lung masking 47 s; a
  full-size 5-fold ensemble adds about 2 s). The worker container peaked at 2.2 GB of
  memory. The CI timing is in the Phase 5 pull request.

### Upgrade notes
- Run `make up`. It rebuilds the images (the AI libraries make the first build take several
  minutes), installs the demo model into `models/` if no model is there, and applies migration
  `0005`. `STUB_STEP_SECONDS` can be removed from `.env`. To install a released model, set
  `MODEL_URL` (and `MODEL_SHA256`) in `.env`, then run `make fetch-model FORCE=1` and
  `make up`.

## [0.4.0] Phase 04: CT upload, de-identification and case workflow

### Added
- **CT upload (FR-04.1):** doctors upload one .zip (any folder structure) or several DICOM
  files for a patient from the **Upload CT** button (dashboard: choose the patient first;
  patient page: straight to the upload form). Files can be picked or dragged in; a progress bar
  shows the upload and the upload can be cancelled. The limit is 1.5 GB, checked in the
  browser, from the request size and while streaming. The upload is written straight to a
  staging folder (never held in memory); nginx allows 1600 MB on that route and passes it
  through without buffering. Measured: a 501 MB upload took 10.9 s to finish, including
  validation and de-identification (NFR-1 target: under 2 min).
- **Validation (FR-04.2):** files are DICOM; Modality = CT; axial orientation (within 20°);
  at least 50 slices; all slices the same rows × columns; slice spacing at most 5 mm. Each
  failure has a plain-language reason (e.g. "The scan has 30 slices; at least 50 are
  needed."). The reasons never quote file names or DICOM values. Damaged files, damaged or
  password-protected zips, and zip bombs are refused too.
- **Series choice (FR-04.3):** the series with the most slices is used (ties go to the lower
  series number). The choice is shown on the timeline, e.g. "3 image series found; used
  series 4 with the most slices (80; others: 55, 2)".
- **De-identification (FR-04.4):** a DICOM PS3.15 Basic Profile subset is applied in memory
  before anything is written to `DATA_DIR/cases/<case id>/dicom/`:
  - removed or emptied: names, IDs, birth date, addresses and phone numbers, institution and
    station, physicians and operators, accession numbers and free-text comments, also inside
    sequences;
  - all private tags removed;
  - Study, Series, SOP and Frame of Reference UIDs replaced with new ones;
  - `PatientIdentityRemoved = YES` set.

  Only the selected series is kept, and the staged originals are always deleted.
- **Scan details (FR-04.5):** study date, slices, slice thickness and spacing, pixel spacing,
  image size, manufacturer, model and kernel are stored and shown.
- **Case workflow (FR-08.1, FR-04.6):** Uploaded → Validating → Queued → Preprocessing →
  Analysing → Completed / Failed, each step timestamped. Only these moves are allowed. A
  rejected scan becomes a Failed case with its reason. After validation the analysis job is
  queued on RQ.
- **Stub analyser (temporary, Phase 4 only):** the worker walks the case through Preprocessing
  and Analysing to Completed and stores the placeholder result **STUB**, flagged as a stub.
  Every screen says that no AI analysis was performed. Phase 5 replaces it with the AI
  pipeline.
- **Case page:** status timeline (done / current / pending / failed), scan details, the stub
  result, and the failure reason. It refreshes every 2 seconds until the case ends.
- **Notifications (FR-08.2, FR-08.3):** the uploading doctor is notified when a case completes
  or fails. A bell in the header shows the unread count (checked every 10 seconds) and lists
  notifications. Opening one goes to the case and marks it read, and there is **Mark all as
  read**. API endpoints:
  - `GET /api/notifications`
  - `GET /api/notifications/unread-count`
  - `POST /api/notifications/{id}/read`
  - `POST /api/notifications/read-all`
- **Patient page and dashboard:**
  - The patient page lists the patient's scans with date, status, result and a link to each
    case.
  - Dashboard counts and recent cases are now real and refresh every 10 seconds.
- **Audit (FR-09.2):** `scan_uploaded` records who uploaded what kind of upload and its size,
  identifying the case by id only.
- **Other API:** `POST /api/patients/{id}/cases` (upload) and `GET /api/cases/{id}`. All
  doctor-only.
- `make demo-scan` writes two synthetic test scans to `demo-data/` (one that is accepted and
  one with too few slices) for trying uploads. `app.synthetic_dicom` generates them; the tests
  use it for valid, invalid and multi-series scans. No real patient data is involved.
- Alembic migration `0004` (cases, case_events, notifications).
- CI full-stack job: the seeded doctor uploads a synthetic scan and waits for Completed (STUB).
  The job then checks:
  - the notification and the dashboard count;
  - a too-short scan is refused with the documented reason;
  - stored files are de-identified and staging is empty;
  - the logs hold no patient identifiers;
  - deleting the patient removes the stored scan.

### Changed
- Deleting a patient now removes the folder of each of their cases. The database removes their
  cases, timelines and notifications (ON DELETE CASCADE).
- Uploads that were being checked when the API stopped are marked Failed at start-up, and the
  staging area is cleared, so identifiable originals cannot linger (NFR-3, NFR-4).
- Version 0.4.0.

### Upgrade notes
- Run `make up`: the backend applies migration `0004` on start. No `.env` changes needed
  (optional: `MAX_UPLOAD_BYTES`, `STUB_STEP_SECONDS`).

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
