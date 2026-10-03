# Requirements traceability

Maps every functional requirement (FR) in section 10 of
[`scope/CaviNet_Scope_Document_v2.md`](scope/CaviNet_Scope_Document_v2.md) to the code that
implements it and the automated tests that prove it. Each phase updates the rows it
implements (definition of done, section 14.3).

**Status values:** Planned · In progress · Implemented (all listed tests pass in CI).

## Foundation (Phase 1)

Phase 1 implements no functional requirement; it provides the platform they are built on.

| Item | Implemented in | Tests | Status |
|---|---|---|---|
| `GET /api/health` reports API, database and Redis status (503 when degraded) | `backend/app/api/routes/health.py`, `backend/app/core/database.py`, `backend/app/core/redis.py` | `backend/tests/test_health.py`, `test_checks.py`, `test_integration.py::test_health_ok_against_real_services` | Implemented |
| Database migrations (Alembic; `0003` adds patients) | `backend/alembic/` | `backend/tests/test_integration.py::test_migrations_upgrade_downgrade_and_match_the_models` | Implemented |
| Background job queue and worker (RQ) | `backend/app/workers/` | `backend/tests/test_worker.py` | Implemented |
| `cavinet-ml --version` | `ml/cavinet_ml/cli.py` | `ml/tests/test_cli.py` | Implemented |
| Web app shell, routing, system status card | `frontend/src/` | `frontend/src/**/*.test.tsx` | Implemented |
| One-command deployment, http://localhost:8080 (NFR-6) | `docker-compose.yml`, `Makefile`, `frontend/nginx.conf` | CI job "Full stack (make up + health check)" | Implemented |
| CI, linting and formatting (NFR-7) | `.github/workflows/ci.yml`, `ruff.toml`, `frontend/eslint.config.js`, `.pre-commit-config.yaml` | CI | Implemented |

## Functional requirements

| FR ID | Requirement (summary) | Phase | Implemented in | Tests | Status |
|---|---|---|---|---|---|
| FR-01.1 | Users log in with email and password. Passwords are hashed with Argon2id; minimum 10… | 2 | `backend/app/core/security.py`, `backend/app/services/auth.py`, `frontend/src/pages/LoginPage.tsx` | `backend/tests/test_security.py::test_fr01_1_*`, `backend/tests/test_auth.py::test_fr01_1_*`, `backend/tests/test_auth.py::test_fr01_2_login_success_*`, `frontend/src/pages/LoginPage.test.tsx` | Implemented |
| FR-01.2 | Successful login issues a 30-minute access token (JWT) and an 8-hour refresh token in an… | 2 | `backend/app/core/security.py`, `backend/app/services/auth.py`, `backend/app/api/routes/auth.py`, `frontend/src/api/client.ts` | `backend/tests/test_auth.py::test_fr01_2_*` (login, 30-min expiry, refresh rotation, 8-h session, logout), `backend/tests/test_security.py::test_fr01_2_*`, `frontend/src/auth/session.test.tsx` | Implemented |
| FR-01.3 | Two roles: Doctor and Admin (Section 9.3). Every API endpoint checks the role server-side;… | 2 | `backend/app/api/deps.py` (`require_roles`), `backend/app/main.py` (`PUBLIC_PATHS`), `frontend/src/auth/RequireAuth.tsx` | `backend/tests/test_role_coverage.py` (walks every endpoint: 401 without token, 403 for the wrong role), `frontend/src/auth/session.test.tsx` | Implemented |
| FR-01.4 | After 5 failed logins an account is locked for 15 minutes. | 2 | `backend/app/services/auth.py::authenticate` | `backend/tests/test_auth.py::test_fr01_4_*`, `backend/tests/test_integration.py::test_account_flow_on_postgres`, `frontend/src/pages/LoginPage.test.tsx` | Implemented |
| FR-01.5 | The frontend logs the user out after 30 minutes of inactivity. | 2 | `frontend/src/auth/useInactivityTimeout.ts`, `frontend/src/auth/AuthProvider.tsx` | `frontend/src/auth/useInactivityTimeout.test.ts`, `frontend/src/auth/session.test.tsx` (signs out after inactivity) | Implemented |
| FR-01.6 | No email server: an admin resets a password by setting a temporary one; the user must change… | 2 | `backend/app/services/users.py::reset_password`, `backend/app/api/deps.py` (pending-change block), `frontend/src/pages/ChangePasswordPage.tsx` | `backend/tests/test_auth.py::test_fr01_6_*`, `backend/tests/test_admin_users.py::test_fr01_6_*`, `backend/tests/test_role_coverage.py::test_fr01_6_*`, `frontend/src/pages/ChangePasswordPage.test.tsx` | Implemented |
| FR-01.7 | The first admin account is created from environment variables on first start. | 2 | `backend/app/services/users.py::ensure_initial_admin`, `backend/app/main.py` (startup), `scripts/init_env.sh` | `backend/tests/test_bootstrap.py`, CI job "Full stack" (signs in as the generated admin) | Implemented |
| FR-02.1 | Shows counts: total patients, scans uploaded in the last 7 days, cases in progress, completed… | 3 | `backend/app/services/dashboard.py::stats`, `backend/app/api/routes/dashboard.py`, `frontend/src/pages/DashboardPage.tsx` (stat cards) | `backend/tests/test_dashboard.py::test_fr02_1_*`, `frontend/src/pages/DashboardPage.test.tsx` | Implemented (scan and case counts are 0 until Phase 4 adds cases) |
| FR-02.2 | Shows the 10 most recent cases (patient, upload time, status, result if complete) with links. | 3 | `backend/app/services/dashboard.py::recent_cases`, `backend/app/schemas/dashboard.py::RecentCase`, `frontend/src/pages/DashboardPage.tsx` (recent-cases table) | `backend/tests/test_dashboard.py::test_fr02_2_*`, `frontend/src/pages/DashboardPage.test.tsx` | Implemented (empty until Phase 4 adds cases) |
| FR-02.3 | Has an "Upload CT" shortcut and a patient search box. | 3 | `frontend/src/pages/DashboardPage.tsx`, `frontend/src/components/UploadCtButton.tsx` | `frontend/src/pages/DashboardPage.test.tsx` (search opens the patient list; Upload CT disabled with tooltip) | Implemented (Upload CT is enabled in Phase 4) |
| FR-03.1 | Patient fields: full name (required), hospital MR number (required, unique), date of birth… | 3 | `backend/app/models/patient.py`, `backend/alembic/versions/0003_patients.py`, `backend/app/schemas/patients.py`, `frontend/src/pages/patients/patientForm.ts`, `frontend/src/pages/patients/PatientFormPage.tsx` | `backend/tests/test_patients.py::test_fr03_1_*` (fields, unique MR number incl. the database race, validation messages), `backend/tests/test_integration.py::test_patient_flow_on_postgres`, `frontend/src/pages/patients/PatientFormPage.test.tsx`, `frontend/src/pages/patients/patientForm.test.ts` | Implemented |
| FR-03.2 | Doctors can create, view, edit and delete patients; deletion requires confirmation and… | 3 | `backend/app/services/patients.py`, `backend/app/services/storage.py`, `backend/app/api/routes/patients.py`, `frontend/src/pages/patients/PatientDetailPage.tsx` (delete dialog), `PatientFormPage.tsx` | `backend/tests/test_patients.py::test_fr03_2_*` (CRUD, MR-number confirmation, files and child rows removed), `backend/tests/test_patients.py::test_admin_gets_403_from_every_patient_endpoint`, `backend/tests/test_role_coverage.py`, `frontend/src/pages/patients/PatientDetailPage.test.tsx` | Implemented (scans, results and reports cascade once Phases 4–7 add them) |
| FR-03.3 | Patient list with search by name or MR number, sorting and pagination (20 per page). | 3 | `backend/app/services/patients.py::list_patients`, `frontend/src/pages/patients/PatientsPage.tsx` | `backend/tests/test_patients.py::test_fr03_3_*`, `backend/tests/test_integration.py::test_patient_flow_on_postgres`, `frontend/src/pages/patients/PatientsPage.test.tsx` | Implemented |
| FR-03.4 | Patient detail page lists all scans with date, status and result. | 3 | `backend/app/schemas/patients.py::PatientDetail`, `frontend/src/pages/patients/PatientDetailPage.tsx` (Scans section) | `backend/tests/test_patients.py::test_fr03_2_view_patient_detail_with_empty_scan_history`, `frontend/src/pages/patients/PatientDetailPage.test.tsx` | Implemented (empty until Phase 4 adds scans) |
| FR-04.1 | Accepts one .zip (any folder structure) or multiple .dcm files for one patient; maximum total… | 4 | — | — | Planned |
| FR-04.2 | Validation: files are DICOM; Modality = CT; axial orientation; ≥ 50 slices; consistent… | 4 | — | — | Planned |
| FR-04.3 | If several series are present, the one with the most slices is used (same rule as the dataset… | 4 | — | — | Planned |
| FR-04.4 | De-identification on arrival: names, IDs, birth date, addresses, institution, physicians,… | 4 | — | — | Planned |
| FR-04.5 | Stored scan metadata: study date, number of slices, slice thickness, pixel spacing,… | 4 | — | — | Planned |
| FR-04.6 | After successful validation, an analysis job is queued automatically. | 4 | — | — | Planned |
| FR-05.1 | Implements the preprocessing in Section 11.1 exactly as used in training (shared code in the… | 5 | — | — | Planned |
| FR-05.2 | Runs the model ensemble, applies temperature scaling and produces the probability of TB… | 5 | — | — | Planned |
| FR-05.3 | Generates 48 evenly spaced axial preview slices (lung window, PNG) for the viewer and 3… | 5 | — | — | Planned |
| FR-05.4 | Records model version, processing time and any warnings (e.g. lung segmentation fallback used). | 5 | — | — | Planned |
| FR-05.5 | If preprocessing or inference fails, the case is marked Failed with the reason; the worker… | 5 | — | — | Planned |
| FR-05.6 | Until the real model exists, a clearly labelled demo model (trained on synthetic data) is used… | 5 | — | — | Planned |
| FR-06.1 | Shows predicted class (TB or NTM), probability of TB (0–100%), confidence (probability of the… | 5 | — | — | Planned |
| FR-06.2 | Shows a plain-language explanation, e.g. "The scan pattern is more consistent with TB… | 5 | — | — | Planned |
| FR-06.3 | Shows the model's validated performance (test AUC, sensitivity, specificity) from the model… | 5 | — | — | Planned |
| FR-06.4 | Includes a slice viewer with a slider over the 48 preview slices. | 5 | — | — | Planned |
| FR-07.1 | One-click PDF download for completed cases. | 7 | — | — | Planned |
| FR-07.2 | Contents: CaviNet header, report date, patient name, MR number, age, sex, scan details,… | 7 | — | — | Planned |
| FR-07.3 | Report downloads are recorded in the audit log. | 7 | — | — | Planned |
| FR-08.1 | Case statuses: Uploaded → Validating → Queued → Preprocessing → Analysing → Completed /… | 4 | — | — | Planned |
| FR-08.2 | In-app notification (bell icon with unread count) to the uploading doctor when a case… | 4 | — | — | Planned |
| FR-08.3 | Notifications can be marked read individually or all at once. | 4 | — | — | Planned |
| FR-09.1 | Admin can create users, assign role, deactivate/reactivate users and reset passwords (FR-01.6). | 2 | `backend/app/services/users.py`, `backend/app/api/routes/admin.py`, `frontend/src/pages/admin/UsersPage.tsx` | `backend/tests/test_admin_users.py::test_fr09_1_*`, `frontend/src/pages/admin/UsersPage.test.tsx` | Implemented |
| FR-09.2 | Audit log records: login success/failure, logout, user management actions, patient… | 2 | `backend/app/services/audit.py`, `backend/app/models/audit_log.py`, `backend/app/core/request_context.py`, `backend/app/services/patients.py` | `backend/tests/test_audit.py::test_fr09_2_every_audit_action_so_far_is_recorded`, `test_fr09_2_audit_entries_never_contain_passwords`, `backend/tests/test_patients.py::test_create_edit_and_delete_are_audited_without_patient_identity` | Implemented (account and patient events); upload, result and report events arrive in Phases 4–7 |
| FR-09.3 | Admin can view and filter the audit log (by user, action, date). | 2 | `backend/app/api/routes/admin.py::list_audit_logs`, `frontend/src/pages/admin/AuditLogPage.tsx` | `backend/tests/test_audit.py::test_fr09_3_*`, `frontend/src/pages/admin/AuditLogPage.test.tsx` | Implemented |
| FR-09.4 | Admin can view model information: version, training date, demo/real flag, validated metrics. | 5 | — | — | Planned |
| FR-10.1 | cavinet-ml index: reads the Kaggle zip or extracted folder plus PatientIndex.xlsx and writes… | 6, 8 | — | — | Planned |
| FR-10.2 | cavinet-ml preprocess: applies Section 11.1 to every case, processing the zip patient by… | 6, 8 | — | — | Planned |
| FR-10.3 | cavinet-ml split: creates the locked test set and 5 folds (Section 11.3) and saves splits.json. | 6, 8 | — | — | Planned |
| FR-10.4 | cavinet-ml train --fold k: trains one fold per Section 11.4 with checkpoints, resume, early… | 6, 8 | — | — | Planned |
| FR-10.5 | cavinet-ml calibrate: collects out-of-fold predictions and fits temperature scaling. | 6, 8 | — | — | Planned |
| FR-10.6 | cavinet-ml export: writes the model bundle (Section 11.6) and model_card.json. | 6, 8 | — | — | Planned |
| FR-10.7 | cavinet-ml evaluate --split test: runs the full evaluation (Section 11.7); refuses to run… | 6, 8 | — | — | Planned |
| FR-10.8 | cavinet-ml baseline, shortcut-check and compare: clinical-only model, metadata-only model and… | 6, 8 | — | — | Planned |
| FR-11.1 | Grad-CAM computed on the last convolutional block of each fold model, averaged and mapped back… | 10 (optional) | — | — | Planned |
| FR-11.2 | Viewer toggle to overlay the heatmap; the 3 slices with the highest heatmap share are… | 10 (optional) | — | — | Planned |
| FR-11.3 | Label: "Regions that most influenced the prediction. This is not a lesion marker." | 10 (optional) | — | — | Planned |
| FR-11.4 | Evaluation: share of heatmap energy inside the lung mask, averaged over the test set (H4). | 10 (optional) | — | — | Planned |
| FR-12.1 | At upload, the doctor may tick which of the 12 dataset symptoms are present; age and sex come… | 11 (optional) | — | — | Planned |
| FR-12.2 | A logistic-regression fusion model combines the CT model output with age, sex and symptoms;… | 11 (optional) | — | — | Planned |
| FR-12.3 | The result page and PDF show both the CT-only and the combined result; if no symptoms are… | 11 (optional) | — | — | Planned |
