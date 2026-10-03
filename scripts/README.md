# Data audit — Tianjin mycobacterial CT dataset

`audit_tianjin.py` inspects the Kaggle dataset
[`damianhan/dicom-dataset`](https://www.kaggle.com/datasets/damianhan/dicom-dataset)
(871 TB + ~430 NTM chest CTs, lesion annotations for ~240 patients) and writes a
report answering: how many patients, what the scans look like, what format the
annotations are in, **how many patients have a cavity annotation**, and what data
problems exist. It does not assume a folder layout.

> **Before running:** see [`docs/audit/kaggle_sample_findings.md`](../docs/audit/kaggle_sample_findings.md).
> The Kaggle release has **no lesion/cavity annotation files**. Only `PatientIndex.xlsx`
> flags which 239 patients were annotated. Expect sections 3–4 of the report to be empty.

## Run it on Kaggle (recommended — no download needed)

1. kaggle.com → **Create → New Notebook**.
2. Right panel → **Add Input** → search `damianhan dicom-dataset` → **Add**.
3. Settings: Accelerator **None** (CPU is enough), Internet **On**.
4. Upload `audit_tianjin.py` (**File → Upload** or paste it into a cell with `%%writefile audit_tianjin.py`).
5. Run:

```python
!ls /kaggle/input/                       # confirm the dataset folder name
!pip install -q pydicom SimpleITK        # usually already installed

# trial run on 50 folders (~1 min) to check everything works
!python audit_tianjin.py --root /kaggle/input/dicom-dataset --out /kaggle/working/audit_trial --max-dirs 50

# full run (reads ~1,300 patients' DICOM headers; expect roughly 10–40 min)
!python audit_tianjin.py --root /kaggle/input/dicom-dataset --out /kaggle/working/audit
```

6. View the report:

```python
from IPython.display import Markdown

Markdown(open("/kaggle/working/audit/audit_report.md").read())
```

7. Download `/kaggle/working/audit/` from the **Output** panel and commit
   `audit_report.md` + the CSVs to the repo under `docs/audit/`.

## Run it locally

```bash
pip install pydicom SimpleITK pandas numpy scipy openpyxl
python scripts/audit_tianjin.py --root /path/to/dicom-dataset --out audit_out
```

## Outputs

| File | Contents |
|---|---|
| `audit_report.md` | Human-readable summary with the decisions each number drives |
| `series.csv` | One row per CT series: patient, slices, thickness, spacing, gaps, scanner, PHI flags |
| `annotation_files.csv` | One row per annotation volume: format, size, spacing, read errors |
| `segments.csv` | One row per lesion segment: name, lesion type, voxels, volume (mL), slice range, number of separate lesions |
| `file_types.csv`, `tree.txt` | Inventory and folder tree |
| `hu_sample.csv` | Hounsfield-unit sanity check on random series |

## Options

| Flag | Meaning |
|---|---|
| `--max-dirs N` | Stop after N DICOM folders (quick trial) |
| `--workers N` | Parallel header readers (default: all CPUs) |
| `--hu-sample N` | Series to fully load for the HU check (default 10, `0` = skip) |

If segment names show up as `unknown` in section 4 of the report, add them to
`LESION_KEYWORDS` at the top of the script and re-run.
