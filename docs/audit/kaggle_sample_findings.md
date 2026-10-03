# Tianjin Mycobacterial CT dataset — what is actually on Kaggle

Checked 2026-10-03 through the Kaggle API: dataset listings, `PatientIndex.xlsx`,
3 DICOM slices (TB_016, NTM Case_001), 1 NIfTI volume (TB_016) and the authors'
preprocessing scripts. The full header audit (`scripts/audit_tianjin.py`) still needs
to be run inside a Kaggle notebook.

## Two Kaggle datasets, both CC BY 4.0

| Dataset | Contents | Size |
|---|---|---|
| [`damianhan/dicom-dataset`](https://www.kaggle.com/datasets/damianhan/dicom-dataset) | `TB/TB_001…TB_871`, `NTM/Case_001…Case_430` (one folder of `.dcm` slices per patient), `PatientIndex.xlsx` | ~92 GB |
| [`damianhan/nifti-dataset`](https://www.kaggle.com/datasets/damianhan/nifti-dataset) | `TBNifTI/TB_xxx.nii`, `NTMNiFTi/Case_xxx.nii` (1,301 volumes) + 3 preprocessing scripts | ~195 GB |

## ⚠️ No lesion / cavity annotations are published

- The NIfTI dataset's subtitle says "Pretreated Dataset And Annotation Dataset", but its
  current version (v5) contains only the 1,301 CT volumes and 3 `.py` files.
- Annotated case folders (e.g. `TB/TB_016`) contain only DICOM slices.
- `PatientIndex.xlsx` has an `Annotation Status` column: **239 patients flagged
  (119 TB, 120 NTM)**, but **no column saying which lesions (cavity, GGO, …) they have**.

**Consequence:** with Kaggle data alone, the only labels for all 1,301 patients are
**TB vs NTM**, NTM species, demographics and symptoms. Cavity labels must come from
(a) the authors (Scientific Data 2025 paper, Tianjin Haihe Hospital), (b) our own
radiologist labelling, or (c) ImageCLEF 2019/2020/2022 and DeepPulmoTB.

## PatientIndex.xlsx

| Sheet | Rows | Columns |
|---|---|---|
| `TB` | 871 patients (+ legend rows at the end) | Number (`TB_001`…), Gender (1 = M, 2 = F), Age, 12 symptoms (Chest pain, Cough, Expectoration, Fever, Chest tightness, Haemoptysis, Gasp, Dyspnoea, Chills, Fatigue, Night sweats, Weight loss), Annotation Status |
| `NTM` | 430 patients | same + **Strain Type**: M. intracellulare 100, abscessus 70, kansasii 67, avium 41, gordonae 12, fortuitum 11, others 7, blank 122 |

Median age: TB 49, NTM 59. Male: TB 72%, NTM 62%. Age and sex differ between groups,
so a TB-vs-NTM model must be checked for learning age/sex shortcuts.

## DICOM (sample)

| | TB_016 | NTM Case_001 |
|---|---|---|
| Scanner | GE BrightSpeed | Toshiba Aquilion ONE |
| Kernel | STANDARD | FC13 |
| Slice thickness | 1.25 mm | 1.0 mm |
| Pixel spacing | 0.70 mm | 0.76 mm |
| Matrix | 512 × 512 | 512 × 512 |
| Compression | **JPEG Lossless** | uncompressed |
| Study date | 2018 | 2023 |

- **PatientID and PatientName are blank** (anonymised) → identify patients by folder name.
  Sex, age and institution name remain in the headers.
- JPEG-Lossless files need SimpleITK/GDCM (or `pylibjpeg`) to decode pixels.
- File-name order ≠ slice order (`TB_016_0002.dcm` is InstanceNumber 10) → sort by
  `ImagePositionPatient`, never by file name.
- Pixels outside the scan circle are −3024 (GE) / −2048 (Toshiba) → clip to −1024 before windowing.
- Different scanners and kernels for TB vs NTM in this sample: check across the full set
  that scanner/kernel doesn't correlate with the label (shortcut risk).

## NIfTI (ready for training)

`TB_016.nii`: 360 × 360 × 276, **1 × 1 × 1 mm**, float32, values **0–1**.
Matches the authors' scripts: DICOM → NIfTI (largest series per folder) → resample to
1 mm isotropic (linear) → lung window **WL −600 / WW 1500** → scale to [0, 1].
These volumes can go straight into a 3D model. HU values are no longer available in them.
