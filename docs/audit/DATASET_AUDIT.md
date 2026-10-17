# Dataset audit: Tianjin mycobacterial CT dataset (Phase 8)

The full dataset as used to train and evaluate the CaviNet model (scope document sections 7 and
15.9). Every number below comes from the training toolkit's own outputs on the GPU computer,
`cavinet-ml index` (`work/manifest.csv`, `work/manifest.json`) and `cavinet-ml preprocess`
(`work/qc/qc_report.csv`). Those files stay local (git-ignored). This page holds aggregates and
case IDs only; no images, no per-patient clinical values.

| | |
|---|---|
| Dataset | Mycobacterial CT Imaging Dataset (Tianjin Haihe Hospital, China, 2014–2024), Kaggle [`damianhan/dicom-dataset`](https://www.kaggle.com/datasets/damianhan/dicom-dataset), CC BY 4.0 |
| Obtained | Downloaded from the Kaggle website and extracted on 2026-10-09; indexed and preprocessed on 2026-10-17 |
| Toolkit | `cavinet-ml` 0.9.0 (CaviNet-ML `phase-08-training`), Python 3.11.9, PyTorch 2.14.1 (CUDA 13.0) |
| GPU computer | Windows 10, AMD Ryzen 7 7700, 32 GB RAM, NVIDIA GeForce RTX 4060 Ti 8 GB |
| `manifest.csv` SHA-256 | `39a3f348fe1aa9aba20b4961d528097e4115097a5f18fd93d2d6607e613bb723` (recorded in `ml/splits.json` and the model bundle) |

## 1. Files and integrity

| | |
|---|---|
| Layout | `TB/TB_001` … `TB_871`, `NTM/Case_001` … `Case_430` (one folder of `.dcm` slices per patient) and `PatientIndex.xlsx`, as documented |
| Files | 348,755: 348,754 DICOM slices and `PatientIndex.xlsx` |
| Size | 91,756,799,590 bytes (91.76 GB) |
| Checksum | pending: computed during training (the disk was needed for preprocessing first); added in the final Phase 8 commit |

The Kaggle zip was extracted by the team before Phase 8 and not kept, so the runbook's zip
checksum (B4) cannot be recorded. Instead, every file of the extracted copy was hashed (SHA-256,
binary mode). The list of `hash *./relative/path` lines, byte-sorted by path, was itself hashed.
Any copy of the dataset can be checked against it from its root folder (Git Bash or Linux;
`-b` gives the same lines on both):

```bash
find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum -b > dicom-dataset.sha256
sha256sum dicom-dataset.sha256      # must print the fingerprint above
```

## 2. Patients and labels

| | TB | NTM | All |
|---|---|---|---|
| Patient folders | 871 | 430 | 1,301 |
| With DICOM images | 871 | 430 | 1,301 |
| One CT series per folder | 871 | 430 | 1,301 |
| With one clear row in PatientIndex.xlsx | 871 | 426 | 1,297 |

- The counts match the dataset publication and the scope document (871 TB, 430 NTM).
- `PatientIndex.xlsx` lists 1,299 patients. Four NTM folders have no usable index row, so their label cannot
  be cross-checked and the clinical baseline has no data for them. `cavinet-ml split` leaves them
  out, with the reason (section 7.3):
  - not listed: `Case_226`, `Case_227`;
  - listed twice with different values: `Case_252` (rows 251/252: age 38 vs 71) and `Case_253`
    (rows 253/254).
- The legend row at the end of the TB sheet (row 876, "Gender 1:Male 2:Female") is ignored, as
  intended.
- No patient folder is misplaced or duplicated, and no index row lacks a scan folder.

## 3. Demographics and symptoms (the 1,297 patients with an index row)

| | TB (871) | NTM (426) | All (1,297) |
|---|---|---|---|
| Age, median [IQR] | 49 [30–61] | 59 [42–68] | 53 [33–64] |
| Age range | 14–91 | 15–87 | 14–91 |
| Age < 40 | 328 (37.7%) | 95 (22.3%) | 423 |
| Age 40–59 | 290 (33.3%) | 121 (28.4%) | 411 |
| Age ≥ 60 | 253 (29.0%) | 210 (49.3%) | 463 |
| Male | 625 (71.8%) | 262 (61.5%) | 887 |
| Female | 246 (28.2%) | 164 (38.5%) | 410 |

| Symptom (present) | TB | NTM |
|---|---|---|
| Cough | 86.9% | 77.2% |
| Expectoration | 70.3% | 67.8% |
| Fever | 46.6% | 38.3% |
| Haemoptysis | 14.6% | 15.0% |
| Fatigue | 13.4% | 30.8% |
| Chest pain | 12.3% | 12.9% |
| Weight loss | 11.5% | 23.2% |
| Gasp | 10.4% | 16.2% |
| Chest tightness | 9.5% | 10.1% |
| Night sweats | 6.1% | 9.4% |
| Chills | 2.5% | 1.4% |
| Dyspnoea | 0.3% | 2.1% |

NTM patients are older (median 59 vs 49) and more often female, with more fatigue and weight
loss. That's why the clinical-only baseline exists (H2): the CT model must beat a model that
sees only age, sex and symptoms.

## 4. Scanners and acquisition (all 1,301 patients)

| Scanner (manufacturer, model) | Kernel | Slice thickness | TB | NTM | % TB |
|---|---|---|---|---|---|
| GE BrightSpeed | STANDARD | 1.25 mm | 835 | 243 | 77% |
| Toshiba Aquilion PRIME / ONE | FC13 | 1.0 mm | 25 | 149 | 14% |
| Siemens SOMATOM Definition AS+ / go.Top | B31f / Br40f | 1.0 mm (25) or 1.5 mm (24) | 11 | 38 | 22% |

| | TB | NTM | All |
|---|---|---|---|
| Slice thickness 1.0 / 1.25 / 1.5 mm | 29 / 835 / 7 | 170 / 243 / 17 | 199 / 1,078 / 24 |
| Slices in the scan, median [IQR] | 253 [221–253] | 273 [245–394] | 253 [221–273] (range 165–520) |
| Slice spacing (mm), median (range) | 1.25 (0.7–1.25) | 1.25 (0.7–1.25) | 1.25 (0.7–1.25) |
| Pixel spacing (mm), median (range) | 0.70 (0.56–0.96) | 0.70 (0.50–0.89) | 0.70 (0.50–0.96) |
| Matrix | 512 × 512 | 512 × 512 | all |
| JPEG-Lossless compressed | 834 | 323 | 1,157 (89%) |
| Uncompressed (Explicit VR Little Endian) | 37 | 107 | 144 |

Every scan has at least 165 slices (the application's minimum is 50) and no slice gap above 1.25 mm.

> **Scanner and label are strongly linked.** 96% of TB scans (835 of 871) come from the GE
> BrightSpeed (STANDARD kernel, 1.25 mm). 43% of NTM scans (187 of 430) come from Toshiba or
> Siemens scanners (other kernels, 1.0 or 1.5 mm). Slice thickness alone tells GE from the other
> scanners. Scan metadata alone therefore predicts TB vs NTM far better than chance, and a CT
> model could partly learn scanner differences (noise texture, kernel sharpness) instead of disease.
> This is the risk the shortcut check (section 4.4) was designed for:
> - the metadata-only model is reported with the results;
> - the split is stratified by manufacturer;
> - the evaluation reports AUC per manufacturer.
>
> The AUC within GE scans alone (835 TB vs 243 NTM) is the cleanest measure of disease signal.
> Preprocessing (resampling to 1.5 mm, lung window) reduces but cannot remove these differences.

## 5. Index vs DICOM header

The label comes from the folder (TB / NTM). Age and sex for the clinical baseline come from
`PatientIndex.xlsx`. On 31 patients (24 TB, 7 NTM) these disagree with the DICOM header:
- sex on 14, age on 27, both on 10;
- 15 of the age differences exceed 10 years (up to 61, e.g. 86 in the index vs 25 in the header).

These may be data-entry errors or rows attached to the wrong case. They are listed in the `notes` column of `work/manifest.csv` and kept
as published: the index is the documented source of clinical values (section 7.1), and the CT
model does not use them.

## 6. Preprocessing (section 11.1, `cavinet-ml preprocess`)

| | TB | NTM | All |
|---|---|---|---|
| Preprocessed | 871 | 430 | **1,301 (100%)**, target ≥ 98% |
| Failed | 0 | 0 | 0 |
| Lung segmentation fallback (body outline) | 0 | 0 | 0 |

- The lungmask R231 network segmented the lungs of every scan, on the GPU, with no fallback and
  no warning.
- Lung volume: median 4,534 mL (IQR 3,729–5,460), range 1,704–8,714. Four scans are below
  2,000 mL (`TB_484`, `TB_827`, `TB_859`, `Case_392`) and 38 above 7,000 mL. The QC images of the
  extremes were checked: small lungs with fibrosis or extensive disease, and large hyperinflated
  lungs, all cropped correctly. They are anatomy, not segmentation errors, and were kept.
- Mean of the 128³ model input: median 0.668, range 0.53–0.80. None is near 0 or 1, so no crop
  missed the lungs.
- Run time: about 2.2 hours with 3 worker processes (median 15.6 s per scan per worker). The cache is
  1,301 float16 volumes of 128³, 5.1 GB.

## 7. How this run differs from the runbook

| Runbook | This run | Why |
|---|---|---|
| Ubuntu 22.04 or Windows 11 + WSL2 | Windows 10 (native), Git Bash for the shell scripts | C: has 19 GB free (WSL keeps its disk on C:); the toolkit already handles Windows paths and processes |
| Python 3.11 from apt | Python 3.11.9, the Python Software Foundation's NuGet package (signature verified) | The MSI installer cannot run from the desktop app that drove the run (packaged-app file virtualization) |
| PyTorch from the `cu128` index | PyTorch 2.14.1 from the `cu130` index; every other library pinned to CaviNet-ML's last green CI run | 2.14.1 is the version CI tested (`cu128` stops at 2.11); the driver supports CUDA 13.4 |
| Read the zip; zip checksum | Read the extracted folder (supported by the toolkit); per-file fingerprint | The zip was not kept |
| SSD, ≥ 150 GB free | 7,200 rpm HDD, 178 GB free | Available hardware; slower but no effect on results |
| `preprocess --workers 4` | `--workers 3` with `PYTORCH_NO_CUDA_MEMORY_CACHING=1` | Measured on this 8 GB GPU: 3 workers with the caching allocator filled 7.9 GB, without it 6.4 GB at the same speed. No change to any section 11.1 parameter |
| — | `splits.json` written with LF line endings on every platform (CaviNet-ML fix) | On Windows the file was written with CRLF, and its recorded SHA-256 would not have matched the committed file |
