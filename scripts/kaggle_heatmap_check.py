"""Kaggle notebook: hypothesis H4 on the locked test set (Phase 10, FR-11.4).

Notebook settings: Accelerator GPU, Internet on, and add the dataset damianhan/dicom-dataset.
Paste this file into one code cell and run it (about 1 to 2 hours for the 259 patients).
Then download work/evaluation/heatmap_check.json and heatmap_shares.csv from the Output tab.

It installs cavinet-ml from GitHub, downloads the released model (model-v1, checksum checked),
the lungmask weights and splits.json, and runs `cavinet-ml heatmap-check` on the GPU. Only
numbers and patient IDs of the public dataset are written; no scans are copied.
"""

import glob
import hashlib
import os
import subprocess
import sys
import urllib.request

BRANCH = "phase-10-heatmap"  # change to "main" once Phase 10 is merged
WORK = "/kaggle/working"
MODEL_SHA256 = "975e61e437836b3cafd2b66739c39e186805c736f9b4fc155d47f3ace643949a"
DOWNLOADS = {
    "splits.json": f"https://raw.githubusercontent.com/ahmadraza225/CaviNet-ML/{BRANCH}/splits.json",
    "cavinet_model.pth": "https://github.com/ahmadraza225/CaviNet_V1/releases/download/model-v1/cavinet_model.pth",
    "unet_r231-d5d2fc3d.pth": "https://github.com/JoHof/lungmask/releases/download/v0.0/unet_r231-d5d2fc3d.pth",
}


def run(*command: str) -> None:
    print("$", " ".join(command), flush=True)
    subprocess.run(command, check=True)


run(
    sys.executable,
    "-m",
    "pip",
    "install",
    "-q",
    f"cavinet-ml @ git+https://github.com/ahmadraza225/CaviNet-ML.git@{BRANCH}",
)
paths = {}
for name, url in DOWNLOADS.items():
    paths[name] = os.path.join(WORK, name)
    if not os.path.isfile(paths[name]):
        print("Downloading", name, flush=True)
        urllib.request.urlretrieve(url, paths[name])
with open(paths["cavinet_model.pth"], "rb") as handle:
    assert hashlib.sha256(handle.read()).hexdigest() == MODEL_SHA256, "wrong model file"

indexes = glob.glob("/kaggle/input/**/PatientIndex.xlsx", recursive=True)
assert indexes, "Add the dataset damianhan/dicom-dataset to the notebook"
run(
    sys.executable,
    "-m",
    "cavinet_ml",
    "heatmap-check",
    "--data",
    os.path.dirname(indexes[0]),
    "--bundle",
    paths["cavinet_model.pth"],
    "--splits",
    paths["splits.json"],
    "--lungmask-weights",
    paths["unet_r231-d5d2fc3d.pth"],
    "--work",
    os.path.join(WORK, "work"),
    "--docs",
    os.path.join(WORK, "docs"),
    "--device",
    "cuda",
)
print(open(os.path.join(WORK, "work", "evaluation", "heatmap_check.json")).read())
