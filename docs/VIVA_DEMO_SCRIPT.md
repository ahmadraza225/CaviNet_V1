# Viva demo script

About 12 minutes. Practise it once on the demo laptop the day before.

## The day before

1. On the demo laptop: `git pull --recurse-submodules`, then `make up`. Wait until
   `make ps` shows every service healthy and http://localhost:8080 opens. The page **Admin → AI model** must show **model-v1**,
   not the demo model (no red DEMO banner).
2. `make seed` (adds the demo doctor; the password is `DEMO_DOCTOR_PASSWORD` in `.env`).
3. `make demo-scan` (synthetic scans in `demo-data/`: no real patient).
4. Copy two **real verification scans** to the Desktop from the `verification/` folder made in
   Phase 9 (training runbook, part E step 2): `TB_349.zip` and `Case_115.zip`. These are
   de-identified public-dataset scans; delete them after the viva.
5. Run the whole demo once (steps below). Then record a screen capture of it as the fallback
   (step "If something fails").
6. Charge the laptop; turn off sleep, updates and notifications.

## Expected results (model-v1)

| Scan | Truth | Probability of TB | Result | Analysis time |
|---|---|---|---|---|
| `TB_349.zip` (221 slices) | TB | 76.0% | TB (Moderate) | about 40 s |
| `Case_115.zip` (361 slices) | NTM | 26.2% | NTM (Moderate, 73.8%) | about 45 s |
| `demo-data/synthetic_chest_ct.zip` | none (synthetic) | any | any | about 30 s |
| `demo-data/synthetic_too_few_slices.zip` | refused | | "at least 50 slices are needed" | seconds |

Probabilities are from [verification/MODEL_VERIFICATION.md](verification/MODEL_VERIFICATION.md)
(application and toolkit agree within 0.01). With symptoms ticked the combined result differs
a little; it is not part of the verification.

## The demo

1. **Problem (1 min).** TB and NTM look alike on CT and need different treatment; laboratory
   confirmation takes weeks. CaviNet gives a decision-support opinion from the CT in minutes.
2. **Sign in (1 min).** Open http://localhost:8080, sign in as the demo doctor. Show the
   dashboard. Mention: admins cannot see patient data; every action is in the audit log.
3. **Patient (1 min).** Patients → **Add patient**: a made-up name, MR number `VIVA-001`,
   date of birth 1975-04-12, female.
4. **Upload with symptoms (2 min).** **Upload CT** → choose `TB_349.zip`. Tick **Add the
   patient's symptoms**, then **Cough** and **Night sweats**. Click **Upload scan**. Point out
   the progress bar and that names are removed before storage.
5. **Analysis (1 min).** The case page shows the status timeline (Validating → Queued →
   Preprocessing → Analysing → Completed). While it runs, open the second tab and upload
   `synthetic_too_few_slices.zip` for the same patient to show a refused scan with its reason.
6. **Result (3 min).** Back on the TB case:
   - **CT only**: TB, probability, confidence band, explanation, disclaimer;
   - **CT + age, sex and symptoms**: the combined result and what it used;
   - **Slice viewer**: drag through the 48 slices; tick **Show heatmap**, click a top slice;
     read the label "This is not a lesion marker";
   - **Validated performance**: test AUC 0.77 on 259 unseen patients.
7. **Report (1 min).** **Download PDF report**: one page, both results, slices, heatmap,
   model version, signature line.
8. **NTM case (1 min, if time).** Upload `Case_115.zip` without symptoms: NTM, Moderate.
9. **Results summary (1 min).** Open [thesis/HYPOTHESES.md](thesis/HYPOTHESES.md): H1, H2, H5
   supported; H3 and H4 not supported, reported honestly.

## If something fails

| Problem | What to do |
|---|---|
| Page does not open | `make ps`; if a service is down, `make up` again (about 30 s). |
| Red DEMO banner | The trained model is missing: `make fetch-model`, then `make up`. Meanwhile continue: the app works the same. |
| Analysis takes over 3 minutes | Keep talking through the timeline; show a completed case from the rehearsal (Patients → the rehearsal patient). |
| Upload refused unexpectedly | Read the reason aloud (that is a feature); use `demo-data/synthetic_chest_ct.zip`. |
| Laptop or Docker fails completely | Play the screen recording from the rehearsal and use the PDF report and screenshots in [images/manual/](images/manual/). |
| Question about accuracy | [EVALUATION_REPORT.md](EVALUATION_REPORT.md) and [thesis/LIMITATIONS.md](thesis/LIMITATIONS.md). |

After the viva: delete the real verification scans from the laptop and `make down`.
