# CaviNet training runbook (GPU computer)

This runbook takes the team from an empty GPU computer to a trained, evaluated and published
CaviNet model: **Phase 8** of the scope document (section 15.9). Every command is written out;
copy and paste them in order. Commands are run from the repository folder (`CaviNet_V1`) with
the training environment switched on (step A5).

> **Recommended:** install Claude Code on the GPU computer and give it the Phase 8 prompt from
> the scope document; it runs and watches these commands itself. This runbook is what it
> follows, and what you follow if you run the commands yourself.

**The one rule that must never be broken:** the locked test set (20% of the patients) is
evaluated **once**, at the very end, after the model is frozen (part C, step 9). The toolkit
refuses a second run and records every attempt in `docs/audit/evaluation_runs.jsonl`.

## Contents

- [Overview and timing](#overview-and-timing)
- [What you need](#what-you-need)
- [Part A: set up the GPU computer](#part-a-set-up-the-gpu-computer)
- [Part B: Kaggle token and download](#part-b-kaggle-token-and-download)
- [Part C: run the pipeline, step by step](#part-c-run-the-pipeline-step-by-step)
- [Part D: publish the model as a GitHub Release](#part-d-publish-the-model-as-a-github-release)
- [Troubleshooting](#troubleshooting)
- [Last resort: Kaggle's free GPU](#last-resort-kaggles-free-gpu)
- [What to commit, and what never to commit](#what-to-commit-and-what-never-to-commit)

## Overview and timing

| Step | Command | What it makes | Planning time (RTX 3060) |
|---|---|---|---|
| A | setup + `make rehearsal` | a working toolkit, checked on synthetic data | 1–2 hours |
| B | `kaggle datasets download` | `dicom-dataset.zip` (about 92 GB) | 3–10 hours (your connection) |
| C1 | `cavinet-ml index` | `work/manifest.csv` (1,301 patients) | 20–60 minutes |
| C2 | `cavinet-ml preprocess` | `work/cache/` (1,301 × 4 MB) + QC report | 4–8 hours |
| C3 | `cavinet-ml split` | `ml/splits.json` (commit it) | seconds |
| C4 | `cavinet-ml train --fold 0` … `4` | 5 trained fold models | 1–2 hours per fold |
| C5 | `cavinet-ml calibrate` | the temperature | seconds |
| C6 | `baseline`, `shortcut-check`, `compare` | clinical and metadata baselines | 1 minute |
| C7 | `cavinet-ml evaluate --split dev` | cross-validation report | 1 minute |
| C8 | `cavinet-ml export` | `cavinet_model.pth` (about 330 MB) + model card | 1 minute |
| C9 | `cavinet-ml evaluate --split test` | **once**: the final report | 5 minutes |
| D | GitHub Release `model-v1` | the published model | 15 minutes |

The times are the scope document's planning estimates (section 17); a faster GPU or connection
is quicker. **Every long step can be interrupted** (power cut, reboot, closed terminal): run the
same command again and it continues where it stopped.

## What you need

| Item | Minimum | Recommended |
|---|---|---|
| GPU | NVIDIA, 8 GB memory (e.g. RTX 3060 8 GB, RTX 2070) | 12 GB or more |
| System | 16 GB RAM, 6-core CPU; Ubuntu 22.04 or Windows 11 + WSL2 | 32 GB RAM, 8+ cores |
| Disk | **150 GB free on an SSD** (92 GB download + 10 GB cache + working space) | 250 GB |
| Internet | stable, for a 92 GB one-time download | wired |
| Accounts | GitHub (access to the CaviNet_V1 repository); free Kaggle account | — |

Everything below is free. No dataset request or agreement is needed (the dataset is CC BY 4.0).

## Part A: set up the GPU computer

Do **A1** (Ubuntu) **or A2** (Windows), then A3–A6.

### A1. Ubuntu 22.04

1. Install the NVIDIA driver, then restart:

   ```bash
   sudo apt update
   sudo ubuntu-drivers install        # picks the recommended driver
   sudo reboot
   ```

2. Check it: `nvidia-smi` must show your GPU and a line `CUDA Version: 12.x`.
3. Install Python 3.11 and the tools:

   ```bash
   sudo add-apt-repository -y ppa:deadsnakes/ppa
   sudo apt install -y python3.11 python3.11-venv git make tmux unzip
   ```

### A2. Windows 11 + WSL2

1. On **Windows**, install the latest NVIDIA driver for your GPU from nvidia.com (Game Ready or
   Studio). Do **not** install any NVIDIA driver inside Linux later: WSL uses the Windows one.
2. Open PowerShell **as administrator** and run `wsl --install -d Ubuntu-22.04`, restart, then
   open "Ubuntu 22.04" from the Start menu and create a user name and password.
3. Give WSL enough memory: create `C:\Users\<you>\.wslconfig` containing

   ```ini
   [wsl2]
   memory=24GB
   swap=16GB
   ```

   (use about three quarters of your RAM), then run `wsl --shutdown` in PowerShell and reopen
   Ubuntu.
4. In Ubuntu: `nvidia-smi` must show your GPU. If it does not, run `wsl --update` in
   PowerShell and restart Windows.
5. Install Python 3.11 and the tools exactly as in A1 step 3.
6. **Keep everything inside the Linux home folder** (`~`), never under `/mnt/c/…`: Windows
   drives are many times slower from WSL. The WSL disk lives on drive C:, so C: needs the 150 GB
   free.

### A3. Get the code

The repository is private, so sign in first. The simplest way is the GitHub CLI:

```bash
sudo apt install -y gh
gh auth login                       # GitHub.com → HTTPS → log in with a web browser
cd ~
git clone https://github.com/ahmadraza225/CaviNet_V1.git
cd CaviNet_V1
```

Clone it on the drive with the free space: the toolkit writes its files into `CaviNet_V1/work/`.

### A4. Choose the PyTorch build for your driver

`nvidia-smi` shows the highest CUDA version the driver supports (top right, "CUDA Version").
Pick the matching PyTorch index:

| `nvidia-smi` shows | Use |
|---|---|
| 12.4 or higher | `https://download.pytorch.org/whl/cu124` |
| 12.1 to 12.3 | `https://download.pytorch.org/whl/cu121` |
| 11.8 to 12.0 | `https://download.pytorch.org/whl/cu118` |

### A5. Install the training toolkit

```bash
make install-train TORCH_INDEX_URL=https://download.pytorch.org/whl/cu124   # your index from A4
source .venv-train/bin/activate      # do this in every new terminal
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
cavinet-ml --version
```

The Python line must print `True` and your GPU's name. If it prints `False`, see
[Troubleshooting](#troubleshooting) before going on.

### A6. Rehearse on synthetic data

This runs **every** command of part C, in the same order, on a small synthetic look-alike of
the dataset (no patient data), including lung segmentation and training on the GPU:

```bash
REHEARSAL_LUNGMASK=1 make rehearsal
```

It takes about 5 minutes on a GPU. It must end with

```
==> A second test evaluation must be refused:
refused: The locked test set was already evaluated …
Rehearsal finished. Report: work/rehearsal/docs/EVALUATION_REPORT.md …
```

Open `work/rehearsal/docs/EVALUATION_REPORT.md` to see what the real report will look like (the
numbers mean nothing: the data are synthetic). Then remove the rehearsal: `rm -rf work/rehearsal`.

## Part B: Kaggle token and download

### B1. Kaggle API token

1. Log in at kaggle.com (create a free account if needed).
2. Click your picture → **Settings** → **API** → **Create New Token**. A file `kaggle.json`
   downloads.
3. Put it where the Kaggle tool looks for it:

   ```bash
   mkdir -p ~/.kaggle
   mv ~/Downloads/kaggle.json ~/.kaggle/            # WSL: mv /mnt/c/Users/<you>/Downloads/kaggle.json ~/.kaggle/
   chmod 600 ~/.kaggle/kaggle.json
   pip install kaggle                                # inside .venv-train
   kaggle datasets files damianhan/dicom-dataset | head
   ```

   The last command must list `PatientIndex.xlsx` (and the TB/NTM folders' files).

### B2. Check the disk

```bash
df -h ~
```

"Avail" must be at least **150G**. Free space first if it is not.

### B3. Download (run it inside tmux)

The download takes hours, so run it in **tmux**: it keeps running if the terminal closes.

```bash
tmux new -s cavinet                  # later: Ctrl-b then d to detach; `tmux attach -t cavinet` to return
mkdir -p ~/cavinet-data && cd ~/cavinet-data
kaggle datasets download -d damianhan/dicom-dataset
```

The result is `~/cavinet-data/dicom-dataset.zip` (about 92 GB). **Do not unzip it**: the toolkit
reads the zip directly, one patient at a time.

If the download breaks off and the Kaggle tool starts again from zero, use this resumable
download instead (run the same line again to continue; your user name and key are in
`~/.kaggle/kaggle.json`):

```bash
curl -L -C - -u "<kaggle-username>:<kaggle-key>" -o dicom-dataset.zip \
  https://www.kaggle.com/api/v1/datasets/download/damianhan/dicom-dataset
```

### B4. Record the checksum

```bash
cd ~/cavinet-data
sha256sum dicom-dataset.zip | tee dicom-dataset.zip.sha256     # 10–20 minutes
unzip -l dicom-dataset.zip | tail -1                            # total number of files
```

Keep both outputs: they go into `docs/audit/DATASET_AUDIT.md` in Phase 8.

## Part C: run the pipeline, step by step

Before each session:

```bash
tmux attach -t cavinet || tmux new -s cavinet
cd ~/CaviNet_V1
source .venv-train/bin/activate
```

All outputs go to `work/` (local, never committed) unless stated otherwise.

### C1. Index the dataset (FR-10.1)

```bash
cavinet-ml index --data ~/cavinet-data/dicom-dataset.zip
```

It reads `PatientIndex.xlsx` and the DICOM headers (no pixels, nothing extracted) and writes
`work/manifest.csv` (one row per patient: label, age, sex, 12 symptoms, slices, slice
thickness, manufacturer, kernel, notes) and `work/manifest.json` (counts and problems).

Expected output, near the end:

```
Found 1301 patient folders (871 TB, 430 NTM) and 1299 patients in PatientIndex.xlsx.
…
  Not listed in PatientIndex.xlsx: Case_226, Case_227
  Listed twice with different values: Case_252, Case_253
  Ignored index rows: TB row 876: Gender 1:Male 2:Female
```

These four NTM patients are known problems of the published index file; `split` leaves them
out with the reason (their label cannot be cross-checked against the index, and the clinical
baseline needs their data). **If the counts differ from 871 TB / 430 NTM, stop and report it.**

### C2. Preprocess every scan (FR-10.2)

First try 5 patients and look at the result:

```bash
cavinet-ml preprocess --limit 5
```

- The first run downloads the lungmask R231 weights (once, checked by SHA-256) and must say
  `lung segmentation on the GPU`.
- Open `work/qc/qc_images/TB_001.png`: three views of the model input (axial, coronal head up,
  sagittal through one lung). Both lungs must fill the picture.

Then run everything (it skips the 5 already done):

```bash
cavinet-ml preprocess --workers 4
```

- `--workers`: parallel patients. Use 4 with 16 GB RAM, 6 with 32 GB. If the computer becomes
  slow or runs out of memory, stop (Ctrl-C) and restart with fewer workers; nothing is lost.
- It prints one line per patient with the time left. Interrupted? Run the same command again.
- At the end it prints the success rate. **The target is at least 98%** (1,275 of 1,301).

Check the QC report `work/qc/qc_report.csv` (open it in a spreadsheet):

| Column | What to look for |
|---|---|
| `status`, `error` | every `failed` patient and its reason |
| `used_fallback`, `warnings` | `true` means lungmask found no lungs (or under 500 mL) and the crop is the body outline: open that patient's QC image |
| `lung_volume_ml` | adult lungs are usually 2,000–7,000 mL |
| `input_mean` | close to 0 or 1 means a bad crop |

To try the failed patients again (for example after freeing disk space):
`cavinet-ml preprocess --retry-failed`. Do **not** change the section 11.1 parameters to
rescue a few scans; report persistent failures instead.

### C3. Create the locked split (FR-10.3)

```bash
cavinet-ml split
git add ml/splits.json
git commit -m "Add the locked patient split"
git push
```

`ml/splits.json` holds only patient IDs: the locked test set (20%, stratified by label, sex,
age band and scanner manufacturer, seed 42), the 5 development folds, and the excluded patients
with their reasons. It is created once; the command refuses to overwrite it. **Never** re-create
it once training has started.

### C4. Train the five folds (FR-10.4)

```bash
for fold in 0 1 2 3 4; do cavinet-ml train --fold "$fold" || break; done
```

- Settings: `ml/configs/train.yaml` (every value of section 11.4; do not edit it without the
  team's approval). A copy is saved with each fold.
- The first fold downloads the MedicalNet ResNet-18 weights. If that fails it trains from
  scratch and says so; the model card records which happened.
- Each epoch prints a line like
  `Fold 0 epoch 7/60: train loss 0.61, val loss 0.66, val AUC 0.71 (best 0.72 at epoch 5), 95 s`.
  Training stops early when the validation AUC has not improved for 12 epochs.
- Watch it: `tail -f work/runs/fold_0/train_log.csv`, or TensorBoard:
  `tensorboard --logdir work/runs` and open http://localhost:6006; `nvidia-smi` shows the GPU
  working.
- **Interrupted?** Run the same loop again: finished folds are skipped and the current fold
  resumes from its last completed epoch.
- If the GPU runs out of memory, the batch is halved automatically (the effective batch stays
  16) and the message says so.

Each fold's folder `work/runs/fold_<k>/` holds `best.pt`, `last.pt`, `train_log.csv`,
`curves.png`, `config.yaml`, `run.json` and `oof.csv`.

### C5. Calibrate (FR-10.5)

```bash
cavinet-ml calibrate
```

Fits the temperature on the out-of-fold predictions and prints the pooled out-of-fold AUC
(cross-validation, development set) and the calibration error before and after.

### C6. Baselines and comparison (FR-10.8)

```bash
cavinet-ml baseline          # clinical-only model: age, sex, 12 symptoms
cavinet-ml shortcut-check    # metadata-only model: manufacturer, kernel, slice thickness
cavinet-ml compare           # DeLong test: CT model vs clinical-only, same patients
```

All three use exactly the CT model's folds, on the development set only. If the shortcut check
prints a `WARNING` (scan metadata alone separates TB from NTM), keep going but report it: it is
part of the results either way.

### C7. Cross-validation report

```bash
cavinet-ml evaluate --split dev
```

Writes `docs/EVALUATION_REPORT.md` (cross-validation part) and `docs/figures/`. Read it with
the team. This can be re-run any number of times.

### C8. Export and freeze the model (FR-10.6)

```bash
cavinet-ml export --version model-v1
```

Writes `work/export/cavinet_model.pth` (about 330 MB: five folds in float16, the temperature,
the preprocessing settings and the metrics), `work/export/model_card.json` and
`docs/MODEL_CARD.md`. It checks that the file loads exactly as the application loads it. **From
here on the model is frozen**: no more training, calibration or config changes.

### C9. Evaluate the locked test set: ONCE (FR-10.7)

Only when every box is ticked:

- [ ] all five folds finished, `calibrate`, `baseline`, `shortcut-check` and `export` done;
- [ ] the team (Khudema as AI validation lead) has read the cross-validation report;
- [ ] everyone agrees the model in `work/export/cavinet_model.pth` is final.

```bash
cavinet-ml evaluate --split test
```

It runs the frozen model on the test patients through the application's own code and writes the
full `docs/EVALUATION_REPORT.md`: AUC, sensitivity, specificity, PPV, NPV, accuracy, balanced
accuracy, F1, Brier score and calibration error, each with a 95% confidence interval; the
confusion matrix; the reliability diagram; results at the Youden threshold; the clinical
baseline and the DeLong test (**H2**); the shortcut check; subgroup AUCs by sex, age band and
manufacturer; and **H1 / H2 stated as supported or not supported**. It also writes the test
results into the model file and the model card (the weights do not change; the weights SHA-256
proves it).

A second run is refused:

```
refused: The locked test set was already evaluated (1 run(s), first on … by …).
```

If a run genuinely has to be repeated (for example the report could not be written because the
disk was full), the team decides, and it is run with
`cavinet-ml evaluate --split test --force --reason "<why>"`; the repeat and its reason appear in
the report and the log.

### C10. Commit the results

```bash
git add ml/splits.json docs/EVALUATION_REPORT.md docs/figures docs/MODEL_CARD.md docs/audit/evaluation_runs.jsonl
git commit -m "Phase 8: evaluation report, model card and figures"
git push
```

## Part D: publish the model as a GitHub Release

1. Get the checksum: `sha256sum work/export/cavinet_model.pth`.
2. Create the release, either on the website (repository → **Releases** → **Draft a new
   release** → tag `model-v1` → attach `work/export/cavinet_model.pth` and
   `work/export/model_card.json` → **Publish release**), or from the terminal:

   ```bash
   gh release create model-v1 work/export/cavinet_model.pth work/export/model_card.json \
     --title "CaviNet model v1" --notes-file docs/MODEL_CARD.md
   ```

3. In `.env.example` (committed) and your `.env`, set
   `MODEL_URL=https://github.com/ahmadraza225/CaviNet_V1/releases/download/model-v1/cavinet_model.pth`
   and `MODEL_SHA256=<the checksum from step 1>`.
4. On the team laptop: `make fetch-model FORCE=1`, then open the admin **Model** page: the DEMO
   banner is gone and the real test metrics are shown.

> **The repository is private.** Downloading a private repository's release asset needs a
> GitHub login, and `make fetch-model` does not send one yet (Phase 9 integrates the real model).
> Until then: download `cavinet_model.pth` from the release page in a signed-in browser, put it
> at `models/cavinet_model.pth` on the laptop, and the worker uses it for the next scan.

## Troubleshooting

| Problem | What to do |
|---|---|
| `torch.cuda.is_available()` prints `False` | The PyTorch build does not match the driver. Re-check A4, then `pip install --force-reinstall --index-url <index> "torch>=2.3,<3"` inside `.venv-train`. On WSL also run `wsl --update` and update the Windows NVIDIA driver. |
| `nvidia-smi: command not found` (WSL) | Install/update the NVIDIA driver **on Windows**, run `wsl --update` in PowerShell, restart. |
| Kaggle `401 Unauthorized` | The token is wrong or old: create a new one (B1) and replace `~/.kaggle/kaggle.json`; check `chmod 600`. |
| The download keeps breaking | Use the resumable `curl` line in B3; re-run it until it finishes; then check the checksum. |
| `No space left on device` | Free space (`df -h ~`). The cache needs about 5 GB, each fold about 0.5 GB. After `export`, the `last.pt` files in `work/runs/` can be deleted. Then re-run the same command. |
| `BadZipFile` or CRC errors | The download is damaged: download again and compare the checksum. |
| `lungmask weights not found` / weights download fails | Download `https://github.com/JoHof/lungmask/releases/download/v0.0/unet_r231-d5d2fc3d.pth` by hand and run `cavinet-ml preprocess --lungmask-weights /path/to/unet_r231-d5d2fc3d.pth`. |
| Many `used_fallback = true` (more than about 2%) | Check the preprocess log says `lung segmentation on the GPU` (not `--no-lungmask`); look at those QC images; report them. |
| A patient fails with "could not be decoded" | Unusual compression: list it in the audit; do not change the code or parameters without the team. |
| `the GPU ran out of memory with batch size 1` | Close other programs using the GPU (browsers, games: see `nvidia-smi`) and re-run. If it still fails, the GPU is too small: stop and ask (a smaller input size needs re-approval of section 11). |
| Training is very slow | The fold's first line must say `on cuda (AMP on)`. Keep the data on an SSD (inside WSL on Windows). Lower `--num-workers` if the CPU is overloaded, raise it if the GPU is idle. |
| Loss shows `nan` | Note the fold and epoch, then `cavinet-ml train --fold <k> --restart`; report it if it happens again. |
| `holds a run with a different configuration or split` | The config or `splits.json` changed after the fold started. Undo the change, or re-train only that fold with `--restart` if the change was agreed. |
| `refused: The locked test set was already evaluated` | Working as intended (C9). Only the team decides on a repeat with `--force --reason`. |
| The terminal closed / SSH dropped | Work inside tmux (`tmux attach -t cavinet`). Any command can simply be run again. |
| Power cut or reboot | Re-open the session (start of part C) and re-run the command that was running. |

## Last resort: Kaggle's free GPU

Only if no team GPU is available. Kaggle notebooks offer a free GPU (T4 or P100, 16 GB) for
about 30 hours a week, in sessions of at most 12 hours, with 20 GB of saved output.

1. Create a notebook, set **Accelerator → GPU** and **Internet → On**, and add the dataset
   `damianhan/dicom-dataset` as input (it appears unzipped under `/kaggle/input/`).
2. Add a GitHub token as a Kaggle **secret** (`GITHUB_TOKEN`), then in a cell:

   ```bash
   !git clone https://$GITHUB_TOKEN@github.com/ahmadraza225/CaviNet_V1.git /kaggle/working/CaviNet_V1
   %cd /kaggle/working/CaviNet_V1
   !pip install -e "ml[train]"          # PyTorch with CUDA is already installed
   ```

3. Run the part C commands with the folder as data and the work folder on the saved disk, e.g.
   `!cavinet-ml index --data /kaggle/input/dicom-dataset --work /kaggle/working/work` and the
   same `--work /kaggle/working/work` on every later command.
4. Save the notebook output as a dataset version after each session (index + preprocess in one
   session, then one or two folds per session), and attach it as input to the next session so
   training resumes. Results and the rule of one test evaluation are the same.

## What to commit, and what never to commit

| Commit | Never commit |
|---|---|
| `ml/splits.json` (patient IDs only) | `dicom-dataset.zip`, any `.dcm`, `PatientIndex.xlsx` |
| `docs/EVALUATION_REPORT.md`, `docs/figures/` | anything in `work/` (manifest, cache, QC, runs, checkpoints, exports) |
| `docs/MODEL_CARD.md`, `docs/audit/evaluation_runs.jsonl` | `cavinet_model.pth` (it goes to the GitHub Release) |
| `docs/audit/DATASET_AUDIT.md` (Phase 8) | `~/.kaggle/kaggle.json` or any token |

`work/` and model files are already git-ignored. Before every commit, `git status` must not
list anything from `work/` or any data file.
