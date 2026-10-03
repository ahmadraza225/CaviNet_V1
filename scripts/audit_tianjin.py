#!/usr/bin/env python3
"""
audit_tianjin.py
----------------
Data audit for the Tianjin mycobacterial chest CT dataset
(Kaggle: damianhan/dicom-dataset — 871 TB + ~430 NTM patients, DICOM,
lesion annotations for ~240 patients made in 3D Slicer).

The script makes NO assumptions about the exact folder layout. It walks the
dataset, reads DICOM headers (not pixels), finds annotation files and index
tables, and writes a Markdown report plus CSVs that answer:

  1. How many patients / CT series are there, and how many are TB vs NTM?
  2. What do the scans look like (slice thickness, slice count, spacing)?
  3. What format are the annotations (voxel masks? boxes? tables?)
  4. How many patients have a CAVITY annotation, and how big are the cavities?
  5. Are there data problems (missing slices, duplicate series, patient info
     left in DICOM headers, unmatched annotations)?

Usage (Kaggle notebook — add the dataset via "Add Input" first):

    !pip install -q pydicom SimpleITK            # usually preinstalled
    !python audit_tianjin.py --root /kaggle/input/dicom-dataset \
                             --out  /kaggle/working/audit

Quick trial run on a subset first:

    !python audit_tianjin.py --root /kaggle/input/dicom-dataset \
                             --out /kaggle/working/audit --max-dirs 50
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import pandas as pd

try:
    import pydicom
    from pydicom.errors import InvalidDicomError
except ImportError:  # pragma: no cover
    sys.exit("pydicom is required:  pip install pydicom")

try:
    import SimpleITK as sitk
except ImportError:  # pragma: no cover
    sitk = None

try:
    from scipy.ndimage import label as cc_label
except ImportError:  # pragma: no cover
    cc_label = None


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DICOM_EXTS = {".dcm", ".dicom", ".ima", ""}
VOLUME_EXTS = (".seg.nrrd", ".nrrd", ".nii.gz", ".nii", ".mha", ".mhd")
TABLE_EXTS = (".csv", ".xlsx", ".xls", ".tsv")
OTHER_ANNOT_EXTS = (".mrk.json", ".json", ".fcsv", ".vtk", ".stl", ".obj",
                    ".xml", ".txt", ".seg.nrrd")
ARCHIVE_EXTS = (".zip", ".tar", ".gz", ".7z", ".rar")

# Keyword → lesion type. English, Chinese and pinyin variants, because the
# dataset comes from a Chinese hospital and labels may be in any of them.
LESION_KEYWORDS = {
    "cavity":         ["cavit", "cavern", "空洞", "kongdong"],
    "consolidation":  ["consolid", "实变", "shibian"],
    "tree_in_bud":    ["tree", "bud", "树芽", "tib"],
    "ggo":            ["ggo", "ground", "glass", "磨玻璃"],
    "bronchiectasis": ["bronchiect", "支气管扩张", "支扩"],
    "nodule":         ["nodul", "结节"],
    "lung":           ["lung", "肺"],
}

TB_RE = re.compile(r"(?<![a-z])tb(?![a-z])|tubercul|结核", re.I)
NTM_RE = re.compile(r"(?<![a-z])ntm(?![a-z])|nontubercul|non-tubercul|非结核", re.I)


def lesion_type(text: str) -> str:
    """Map a free-text segment / file / column name to a lesion type."""
    t = str(text).lower()
    for ltype, keys in LESION_KEYWORDS.items():
        if any(k in t for k in keys):
            return ltype
    return "unknown"


def class_guess(path_text: str) -> str:
    """Guess TB / NTM from folder names (NTM checked first: '非结核' contains '结核')."""
    if NTM_RE.search(path_text):
        return "NTM"
    if TB_RE.search(path_text):
        return "TB"
    return "unknown"


def full_ext(name: str) -> str:
    n = name.lower()
    for ext in (".seg.nrrd", ".mrk.json", ".nii.gz"):
        if n.endswith(ext):
            return ext
    return os.path.splitext(n)[1]


# ---------------------------------------------------------------------------
# Step 1 — inventory
# ---------------------------------------------------------------------------

def inventory(root: Path, max_dirs: int | None):
    """Walk the dataset once. Returns DICOM-candidate dirs, annotation files,
    tables, a per-extension count and a short tree listing."""
    ext_count, ext_bytes = Counter(), Counter()
    dicom_dirs: dict[str, list[str]] = {}
    volumes, tables, other_annots, archives = [], [], [], []
    tree_lines = []

    for i, (dirpath, dirnames, filenames) in enumerate(os.walk(root)):
        dirnames.sort()
        rel = os.path.relpath(dirpath, root)
        depth = 0 if rel == "." else rel.count(os.sep) + 1
        if depth <= 3:
            tree_lines.append(f"{'  ' * depth}{os.path.basename(dirpath) or str(root)}/"
                              f"  ({len(dirnames)} dirs, {len(filenames)} files)")
        cand = []
        for fn in filenames:
            fp = os.path.join(dirpath, fn)
            ext = full_ext(fn)
            ext_count[ext or "<none>"] += 1
            try:
                ext_bytes[ext or "<none>"] += os.path.getsize(fp)
            except OSError:
                pass
            if ext in VOLUME_EXTS:
                volumes.append(fp)
            elif ext in TABLE_EXTS:
                tables.append(fp)
            elif ext in OTHER_ANNOT_EXTS:
                other_annots.append(fp)
            elif ext in ARCHIVE_EXTS:
                archives.append(fp)
            elif ext in DICOM_EXTS:
                cand.append(fp)
        if cand:
            dicom_dirs[dirpath] = sorted(cand)
            if max_dirs and len(dicom_dirs) >= max_dirs:
                tree_lines.append("... (stopped early: --max-dirs reached)")
                break

    file_types = pd.DataFrame(
        [{"extension": e, "files": n, "size_gb": round(ext_bytes[e] / 1e9, 3)}
         for e, n in ext_count.most_common()])
    return dicom_dirs, volumes, tables, other_annots, archives, file_types, tree_lines


# ---------------------------------------------------------------------------
# Step 2 — DICOM headers, one directory per worker
# ---------------------------------------------------------------------------

def _f(ds, tag, default=None):
    v = getattr(ds, tag, default)
    return default if v in (None, "") else v


def _slice_pos(ds):
    """Position of a slice along the scan axis (mm), or None."""
    ipp = _f(ds, "ImagePositionPatient")
    iop = _f(ds, "ImageOrientationPatient")
    if ipp is not None and iop is not None and len(iop) == 6:
        normal = np.cross(np.array(iop[:3], float), np.array(iop[3:], float))
        return float(np.dot(normal, np.array(ipp, float)))
    if ipp is not None:
        return float(ipp[2])
    return None


def _name_order_matches(items) -> bool:
    """True if sorting files by name gives the same order as InstanceNumber."""
    inst = [int(_f(d, "InstanceNumber", 0) or 0) for _, d in sorted(items, key=lambda x: x[0])]
    return inst == sorted(inst)


def audit_dicom_dir(dirpath: str, files: list[str], root: str) -> list[dict]:
    series = defaultdict(list)
    for fp in files:
        try:
            ds = pydicom.dcmread(fp, stop_before_pixels=True, force=False)
        except (InvalidDicomError, OSError, AttributeError, ValueError, TypeError):
            continue
        except Exception:
            continue
        if not hasattr(ds, "SOPClassUID") and not hasattr(ds, "Rows"):
            continue
        series[str(_f(ds, "SeriesInstanceUID", dirpath))].append((fp, ds))

    rel_dir = os.path.relpath(dirpath, root)
    out = []
    for uid, items in series.items():
        ds0 = items[0][1]
        pos = [p for p in (_slice_pos(d) for _, d in items) if p is not None]
        pos_sorted = np.sort(np.array(pos)) if pos else np.array([])
        diffs = np.diff(pos_sorted) if len(pos_sorted) > 1 else np.array([])
        nz = diffs[diffs > 1e-3]
        z_med = float(np.median(nz)) if len(nz) else None
        thick = [float(_f(d, "SliceThickness")) for _, d in items
                 if _f(d, "SliceThickness") is not None]
        ps = _f(ds0, "PixelSpacing")
        iop = _f(ds0, "ImageOrientationPatient")
        axial = None
        if iop is not None and len(iop) == 6:
            n = np.abs(np.cross(np.array(iop[:3], float), np.array(iop[3:], float)))
            axial = bool(n.argmax() == 2)
        name = str(_f(ds0, "PatientName", "") or "")
        out.append({
            "dir": rel_dir,
            "series_uid": uid,
            "patient_id": str(_f(ds0, "PatientID", "")),
            # PatientID is blank in the Kaggle release, so the case folder identifies the patient
            "patient_key": str(_f(ds0, "PatientID", "")) or os.path.basename(dirpath),
            "transfer_syntax": str(getattr(getattr(ds0, "file_meta", None), "TransferSyntaxUID", "")),
            "files_in_name_order": _name_order_matches(items),
            "study_uid": str(_f(ds0, "StudyInstanceUID", "")),
            "series_desc": str(_f(ds0, "SeriesDescription", "")),
            "modality": str(_f(ds0, "Modality", "")),
            "manufacturer": str(_f(ds0, "Manufacturer", "")),
            "model": str(_f(ds0, "ManufacturerModelName", "")),
            "kernel": str(_f(ds0, "ConvolutionKernel", "")),
            "kvp": _f(ds0, "KVP"),
            "contrast": str(_f(ds0, "ContrastBolusAgent", "")),
            "n_files": len(items),
            "n_unique_positions": int(len(np.unique(np.round(pos_sorted, 2)))) if len(pos_sorted) else 0,
            "n_duplicate_positions": int(len(pos_sorted) - len(np.unique(np.round(pos_sorted, 2)))) if len(pos_sorted) else 0,
            "rows": _f(ds0, "Rows"),
            "cols": _f(ds0, "Columns"),
            "pixel_spacing_mm": float(ps[0]) if ps is not None else None,
            "slice_thickness_mm": float(np.median(thick)) if thick else None,
            "z_spacing_mm": z_med,
            "n_gaps": int((nz > 1.5 * z_med).sum()) if z_med else 0,
            "z_extent_mm": float(pos_sorted[-1] - pos_sorted[0]) if len(pos_sorted) > 1 else None,
            "axial": axial,
            "has_rescale": _f(ds0, "RescaleSlope") is not None and _f(ds0, "RescaleIntercept") is not None,
            "phi_patient_name": bool(name.strip()) and not re.fullmatch(r"(anon\w*|\W*|\d+)", name.strip(), re.I),
            "phi_birth_date": bool(str(_f(ds0, "PatientBirthDate", "")).strip()),
            "phi_institution": bool(str(_f(ds0, "InstitutionName", "")).strip()),
            "class_guess": class_guess(rel_dir),
        })
    return out


# ---------------------------------------------------------------------------
# Step 3 — annotation volumes (3D Slicer .seg.nrrd, label maps, NIfTI)
# ---------------------------------------------------------------------------

def read_nrrd_header(fp: str) -> dict:
    """Parse the ASCII NRRD header (3D Slicer stores segment names here)."""
    hdr = {}
    try:
        with open(fp, "rb") as fh:
            raw = b""
            while b"\n\n" not in raw and len(raw) < 1_000_000:
                chunk = fh.read(65536)
                if not chunk:
                    break
                raw += chunk
        text = raw.split(b"\n\n", 1)[0].decode("utf-8", errors="replace")
        for line in text.splitlines()[1:]:
            if line.startswith("#"):
                continue
            if ":=" in line:
                k, v = line.split(":=", 1)
            elif ":" in line:
                k, v = line.split(":", 1)
            else:
                continue
            hdr[k.strip()] = v.strip()
    except OSError:
        pass
    return hdr


def slicer_segments(hdr: dict) -> list[dict]:
    segs = defaultdict(dict)
    for k, v in hdr.items():
        m = re.match(r"Segment(\d+)_(\w+)$", k)
        if m:
            segs[int(m.group(1))][m.group(2)] = v
    return [dict(index=i, **segs[i]) for i in sorted(segs)]


def audit_volume(fp: str, root: str) -> tuple[dict, list[dict]]:
    rel = os.path.relpath(fp, root)
    info = {"file": rel, "case_dir": os.path.basename(os.path.dirname(fp)),
            "class_guess": class_guess(rel), "format": full_ext(fp),
            "filename_lesion": lesion_type(os.path.basename(fp)), "error": ""}
    seg_rows = []
    hdr = read_nrrd_header(fp) if fp.lower().endswith(".nrrd") else {}
    segs = slicer_segments(hdr)
    info["n_slicer_segments"] = len(segs)

    if sitk is None:
        info["error"] = "SimpleITK not installed — voxel statistics skipped"
        for s in segs:
            seg_rows.append({"file": rel, "segment": s.get("Name", ""),
                             "lesion_type": lesion_type(s.get("Name", ""))})
        return info, seg_rows

    try:
        img = sitk.ReadImage(fp)
    except Exception as e:  # noqa: BLE001
        info["error"] = f"read failed: {e}"[:200]
        return info, seg_rows

    arr = sitk.GetArrayFromImage(img)              # (z, y, x) or (z, y, x, c)
    spacing = img.GetSpacing()[:3]
    voxel_ml = float(np.prod(spacing)) / 1000.0
    info.update({
        "size_xyz": "x".join(str(s) for s in img.GetSize()),
        "spacing_xyz": "x".join(f"{s:.3g}" for s in spacing),
        "origin_xyz": "x".join(f"{o:.1f}" for o in img.GetOrigin()[:3]),
        "components": img.GetNumberOfComponentsPerPixel(),
        "dtype": str(arr.dtype),
        "unique_values": int(len(np.unique(arr))) if arr.size < 5e8 else -1,
    })

    def describe(mask: np.ndarray, name: str, label_value):
        voxels = int(mask.sum())
        row = {"file": rel, "case_dir": info["case_dir"], "class_guess": info["class_guess"],
               "segment": name, "label_value": label_value,
               "lesion_type": lesion_type(name) if lesion_type(name) != "unknown"
               else info["filename_lesion"],
               "voxels": voxels, "volume_ml": round(voxels * voxel_ml, 3)}
        if voxels:
            zs = np.where(mask.any(axis=(1, 2)))[0]
            row["z_first"], row["z_last"] = int(zs[0]), int(zs[-1])
            row["n_slices_with_lesion"] = int(len(zs))
            if cc_label is not None:
                row["n_components"] = int(cc_label(mask)[1])
        seg_rows.append(row)

    if not segs and (np.issubdtype(arr.dtype, np.floating) and info["unique_values"] > 64
                     or info["unique_values"] > 256):
        info["error"] = "looks like an image volume, not a label mask — skipped"
        return info, seg_rows

    if segs:  # 3D Slicer segmentation: use names from header
        for s in segs:
            layer = int(s.get("Layer", 0) or 0)
            lv = int(s.get("LabelValue", 1) or 1)
            if arr.ndim == 4:
                chan = arr[..., min(layer if "Layer" in s else s["index"], arr.shape[-1] - 1)]
                mask = chan == lv if "LabelValue" in s else chan > 0
            else:
                mask = arr == lv
            describe(mask, s.get("Name", f"Segment{s['index']}"), lv)
    else:      # plain label map: one row per non-zero label
        base = arr if arr.ndim == 3 else arr.max(axis=-1)
        for lv in [v for v in np.unique(base) if v != 0][:50]:
            describe(base == lv, f"{os.path.basename(fp)}#label{int(lv)}", int(lv))
    return info, seg_rows


# ---------------------------------------------------------------------------
# Step 4 — index tables (FeaturesIndex.csv / .xlsx etc.)
# ---------------------------------------------------------------------------

def read_tables(fp: str) -> dict[str, pd.DataFrame]:
    if fp.lower().endswith((".xlsx", ".xls")):
        try:
            return pd.read_excel(fp, sheet_name=None)
        except Exception as e:  # noqa: BLE001
            return {"<error>": pd.DataFrame({"error": [str(e)]})}
    sep = "\t" if fp.lower().endswith(".tsv") else ","
    for enc in ("utf-8", "utf-8-sig", "gbk", "gb18030", "latin-1"):
        try:
            return {"<csv>": pd.read_csv(fp, sep=sep, encoding=enc, low_memory=False)}
        except UnicodeDecodeError:
            continue
        except Exception as e:  # noqa: BLE001
            return {"<error>": pd.DataFrame({"error": [str(e)]})}
    return {}


def summarize_table(name: str, df: pd.DataFrame) -> dict:
    cavity_cols = {}
    for col in df.columns:
        if lesion_type(col) == "cavity":
            cavity_cols[str(col)] = df[col].astype(str).value_counts().head(10).to_dict()
        else:
            hits = df[col].astype(str).map(lambda s: lesion_type(s) == "cavity").sum()
            if hits:
                cavity_cols[f"{col} (values mentioning cavity)"] = int(hits)
    return {"name": name, "shape": df.shape, "columns": [str(c) for c in df.columns],
            "head": df.head(5), "cavity": cavity_cols}


# ---------------------------------------------------------------------------
# Step 5 — HU sanity check on a random sample of series
# ---------------------------------------------------------------------------

def hu_sample(series_df: pd.DataFrame, root: Path, n: int, seed: int) -> pd.DataFrame:
    if sitk is None or series_df.empty or n <= 0:
        return pd.DataFrame()
    rows = []
    pick = series_df.sample(min(n, len(series_df)), random_state=seed)
    reader = sitk.ImageSeriesReader()
    for _, s in pick.iterrows():
        d = str(root / s["dir"])
        try:
            files = reader.GetGDCMSeriesFileNames(d, s["series_uid"]) or \
                reader.GetGDCMSeriesFileNames(d)
            reader.SetFileNames(files)
            arr = sitk.GetArrayFromImage(reader.Execute())
            pad = arr < -1100                       # outside the scan circle, e.g. -3024 / -2048
            body = arr[~pad] if (~pad).any() else arr.ravel()
            p = np.percentile(body, [1, 50, 99])
            air = float(((body >= -1050) & (body <= -850)).mean())
            rows.append({"dir": s["dir"], "series_uid": s["series_uid"], "shape": arr.shape,
                         "min": float(arr.min()), "padding_frac": round(float(pad.mean()), 3),
                         "p1": p[0], "median": p[1], "p99": p[2], "max": float(arr.max()),
                         "air_frac": round(air, 3),
                         "looks_like_HU": bool(air > 0.05 and p[2] > 100)})
        except Exception as e:  # noqa: BLE001
            rows.append({"dir": s["dir"], "series_uid": s["series_uid"], "error": str(e)[:200]})
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def md_table(df: pd.DataFrame, max_rows: int = 20) -> str:
    if df is None or df.empty:
        return "_(none)_\n"
    df = df.head(max_rows).copy()
    df.columns = [str(c) for c in df.columns]
    lines = ["| " + " | ".join(df.columns) + " |",
             "|" + "---|" * len(df.columns)]
    for _, r in df.iterrows():
        lines.append("| " + " | ".join(str(v).replace("|", "/").replace("\n", " ")[:60]
                                       for v in r.values) + " |")
    return "\n".join(lines) + "\n"


def describe_num(s: pd.Series) -> str:
    s = pd.to_numeric(s, errors="coerce").dropna()
    if s.empty:
        return "n/a"
    q = s.quantile([0, .25, .5, .75, 1]).round(2).tolist()
    return f"min {q[0]} · Q1 {q[1]} · median {q[2]} · Q3 {q[3]} · max {q[4]}  (n={len(s)})"


def write_report(out: Path, args, file_types, tree_lines, series, vols, segs,
                 table_summaries, other_annots, archives, hu, elapsed):
    L = []
    w = L.append
    w("# Tianjin CT dataset — data audit\n")
    w(f"Root: `{args.root}`  ·  run time {elapsed/60:.1f} min"
      + ("  ·  **partial run (--max-dirs)**" if args.max_dirs else "") + "\n")

    # 1. Inventory
    w("## 1. Inventory\n")
    w(md_table(file_types, 30))
    w("\nFolder tree (first 3 levels):\n```\n" + "\n".join(tree_lines[:120]) + "\n```\n")
    if archives:
        w(f"⚠️ {len(archives)} archive files found (not opened): "
          + ", ".join(f"`{a}`" for a in archives[:10]) + "\n")

    # 2. Patients & scans
    w("## 2. Patients and CT series\n")
    if series.empty:
        w("No DICOM series found. Check `--root`.\n")
    else:
        ct = series[series["modality"].str.upper().isin(["CT", ""])]
        n_pat = ct["patient_key"].replace("", np.nan).nunique()
        w(f"- DICOM series: **{len(series)}** (CT: {len(ct)}) · modalities: {series['modality'].value_counts().to_dict()}")
        w(f"- Distinct patients (PatientID, else case folder): **{n_pat}**  ·  distinct series folders: {series['dir'].nunique()}")
        w(f"- Series per patient: {describe_num(ct.groupby('patient_key').size())}")
        cg = ct.groupby("class_guess")["patient_key"].nunique().to_dict()
        w(f"- TB / NTM guessed from folder names (patients): {cg}"
          " — expected ≈ 871 TB / 430 NTM. If 'unknown' dominates, take labels from the index table instead.")
        w(f"- Slices per series: {describe_num(ct['n_files'])}")
        w(f"- Slice thickness (mm, header): {describe_num(ct['slice_thickness_mm'])}")
        w(f"- Slice spacing (mm, from positions): {describe_num(ct['z_spacing_mm'])}")
        w(f"- In-plane pixel spacing (mm): {describe_num(ct['pixel_spacing_mm'])}")
        w(f"- Matrix: {ct.groupby(['rows', 'cols']).size().sort_values(ascending=False).head(5).to_dict()}")
        w(f"- Axial series: {int(ct['axial'].fillna(False).sum())} / {len(ct)}")
        w(f"- Manufacturers: {ct['manufacturer'].value_counts().head(6).to_dict()}")
        w(f"- Kernels (top 8): {ct['kernel'].value_counts().head(8).to_dict()}")
        w(f"- Transfer syntaxes: {ct['transfer_syntax'].value_counts().to_dict()}"
          " (JPEG-compressed files need SimpleITK/GDCM or pylibjpeg to decode pixels)")
        w(f"- Series whose file-name order ≠ slice order: {int((~ct['files_in_name_order']).sum())}"
          " (always sort slices by position, never by file name)")
        w("")
        thick = pd.to_numeric(ct["slice_thickness_mm"], errors="coerce")
        w("Slice-thickness buckets (decides resampling strategy):\n")
        w(md_table(pd.cut(thick, [0, 1.25, 2.5, 5.01, 100],
                          labels=["≤1.25 mm (thin)", "1.25–2.5 mm", "2.5–5 mm", ">5 mm"])
                   .value_counts(sort=False).rename_axis("thickness").reset_index(name="series")))

    # 3. Annotations
    w("## 3. Annotation files\n")
    if vols.empty:
        w("No annotation volumes (.seg.nrrd / .nrrd / .nii / .mha) found.\n")
    else:
        w(f"- Annotation volumes: **{len(vols)}** in **{vols['case_dir'].nunique()}** case folders")
        w(f"- Formats: {vols['format'].value_counts().to_dict()}")
        w(f"- 3D Slicer segmentation files (segment names in header): "
          f"{int((vols['n_slicer_segments'] > 0).sum())}")
        if "error" in vols:
            errs = vols[vols["error"] != ""]
            if len(errs):
                w(f"- ⚠️ {len(errs)} files could not be read (see annotation_files.csv)")
        w("")
    if other_annots:
        oc = Counter(full_ext(p) for p in other_annots)
        w(f"Other possible annotation files: {dict(oc)} — e.g. "
          + ", ".join(f"`{p}`" for p in other_annots[:5]) + "\n")

    # 4. Lesions / cavities
    w("## 4. Lesions — cavity counts\n")
    if segs.empty:
        w("No segment statistics available.\n")
    else:
        w("Segment names seen (top 30) → mapped lesion type:\n")
        names = segs.groupby(["segment", "lesion_type"]).size().sort_values(ascending=False)
        w(md_table(names.reset_index(name="count"), 30))
        w("\nIf important names are mapped to `unknown`, add them to `LESION_KEYWORDS` and re-run.\n")
        per_type = (segs[segs["voxels"].fillna(0) > 0]
                    .groupby("lesion_type")
                    .agg(cases=("case_dir", "nunique"), segments=("segment", "size"),
                         median_volume_ml=("volume_ml", "median"))
                    .reset_index())
        w(md_table(per_type))
        cav = segs[(segs["lesion_type"] == "cavity") & (segs["voxels"].fillna(0) > 0)]
        w("\n### Cavity summary\n")
        w(f"- **Case folders with a non-empty cavity annotation: {cav['case_dir'].nunique()}**")
        if not cav.empty:
            w(f"- By class (folder guess): {cav.groupby('class_guess')['case_dir'].nunique().to_dict()}")
            w(f"- Cavity volume per segment (mL): {describe_num(cav['volume_ml'])}")
            if "n_components" in cav:
                w(f"- Separate cavities per segment: {describe_num(cav['n_components'])}")
            if "n_slices_with_lesion" in cav:
                w(f"- Slices containing cavity per segment: {describe_num(cav['n_slices_with_lesion'])}")
        w("")

    # Tables
    w("## 5. Index / metadata tables\n")
    if not table_summaries:
        w("No CSV/XLSX tables found.\n")
    for fp, sums in table_summaries.items():
        for t in sums:
            w(f"### `{fp}` — sheet `{t['name']}`  ({t['shape'][0]} rows × {t['shape'][1]} cols)\n")
            w("Columns: " + ", ".join(f"`{c}`" for c in t["columns"][:60]) + "\n")
            w(md_table(t["head"], 5))
            if t["cavity"]:
                w("\nCavity-related columns / values:\n```\n"
                  + json.dumps(t["cavity"], ensure_ascii=False, indent=1, default=str) + "\n```\n")

    # Quality
    w("## 6. Data-quality checks\n")
    if not series.empty:
        w(f"- Series with missing slices (gaps): {int((series['n_gaps'] > 0).sum())}")
        w(f"- Series with duplicate slice positions: {int((series['n_duplicate_positions'] > 0).sum())}")
        w(f"- Series with < 50 slices (likely scout/thick or incomplete): {int((series['n_files'] < 50).sum())}")
        w(f"- Series missing RescaleSlope/Intercept: {int((~series['has_rescale']).sum())}")
        w(f"- Patients with > 1 CT series: {int((series.groupby('patient_key').size() > 1).sum())}"
          " (pick one series per patient, and keep all of a patient's series in the same split)")
        w(f"- ⚠️ Patient info left in headers — names: {int(series['phi_patient_name'].sum())}, "
          f"birth dates: {int(series['phi_birth_date'].sum())}, institution: {int(series['phi_institution'].sum())}"
          " (must be stripped before data goes into the web app)")
    if not vols.empty and not series.empty:
        series_tokens = set(series["patient_key"].astype(str)) | {
            part for d in series["dir"] for part in Path(d).parts}
        matched = vols["case_dir"].astype(str).isin(series_tokens)
        w(f"- Annotation folders whose name matches a PatientID or DICOM folder: "
          f"{int(matched.sum())} / {len(vols)}"
          " (low → work out the linking rule by hand from the tables in section 5)")
    if hu is not None and not hu.empty:
        w("\nHU sanity check on random series (padding < −1100 HU excluded; lungs/air ≈ −1000):\n")
        w(md_table(hu))
    w("")

    # Decisions
    w("## 7. What these numbers decide\n")
    w("- **Cavity case count** → < ~80 cavity patients: use the Kaggle data for the yes/no + Grad-CAM tier and "
      "request ImageCLEF / DeepPulmoTB for segmentation. ≥ ~150: train cavity segmentation (nnU-Net) directly.")
    w("- **Annotation format** → voxel masks enable segmentation and heatmap accuracy (Dice); "
      "points / boxes / table-only labels limit you to detection or classification.")
    w("- **Slice thickness spread** → resample everything to one spacing (e.g. 1×1×1.5 mm, or the dataset median).")
    w("- **Split** → by patient, stratified by TB/NTM and cavity presence; keep ~20% of annotated patients as a locked test set.")
    (out / "audit_report.md").write_text("\n".join(L), encoding="utf-8")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", required=True, help="dataset root, e.g. /kaggle/input/dicom-dataset")
    ap.add_argument("--out", default="audit_out", help="output folder for report + CSVs")
    ap.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2)))
    ap.add_argument("--max-dirs", type=int, default=None, help="stop after N DICOM folders (trial run)")
    ap.add_argument("--hu-sample", type=int, default=10, help="series to load for the HU check (0 = skip)")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    root, out = Path(args.root), Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    t0 = time.time()

    print(f"[1/5] Walking {root} ...", flush=True)
    dicom_dirs, vols_fp, tables_fp, other_annots, archives, file_types, tree = inventory(root, args.max_dirs)
    file_types.to_csv(out / "file_types.csv", index=False)
    (out / "tree.txt").write_text("\n".join(tree), encoding="utf-8")
    print(f"      {sum(len(v) for v in dicom_dirs.values())} DICOM candidates in {len(dicom_dirs)} folders, "
          f"{len(vols_fp)} annotation volumes, {len(tables_fp)} tables", flush=True)

    print(f"[2/5] Reading DICOM headers with {args.workers} workers ...", flush=True)
    rows = []
    with ProcessPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(audit_dicom_dir, d, f, str(root)) for d, f in dicom_dirs.items()]
        for i, fut in enumerate(as_completed(futs), 1):
            rows.extend(fut.result())
            if i % 100 == 0 or i == len(futs):
                print(f"      {i}/{len(futs)} folders", flush=True)
    series = pd.DataFrame(rows)
    series.to_csv(out / "series.csv", index=False)

    print("[3/5] Reading annotation volumes ...", flush=True)
    vol_rows, seg_rows = [], []
    for i, fp in enumerate(vols_fp, 1):
        info, segs = audit_volume(fp, str(root))
        vol_rows.append(info)
        seg_rows.extend(segs)
        if i % 50 == 0:
            print(f"      {i}/{len(vols_fp)}", flush=True)
    vols = pd.DataFrame(vol_rows)
    segs = pd.DataFrame(seg_rows)
    vols.to_csv(out / "annotation_files.csv", index=False)
    segs.to_csv(out / "segments.csv", index=False)

    print("[4/5] Reading index tables ...", flush=True)
    table_summaries = {}
    for fp in tables_fp:
        rel = os.path.relpath(fp, root)
        table_summaries[rel] = [summarize_table(n, df) for n, df in read_tables(fp).items()]

    print("[5/5] HU sanity check ...", flush=True)
    hu = hu_sample(series, root, args.hu_sample, args.seed)
    hu.to_csv(out / "hu_sample.csv", index=False)

    write_report(out, args, file_types, tree, series, vols, segs, table_summaries,
                 other_annots, archives, hu, time.time() - t0)
    print(f"\nDone in {(time.time() - t0)/60:.1f} min → {out/'audit_report.md'}")


if __name__ == "__main__":
    main()
