#!/usr/bin/env bash
# Rehearse every training-toolkit command, in the runbook's order, on a small synthetic
# look-alike of the Kaggle dataset (no patient data): index, preprocess, split, train two folds
# for one epoch, calibrate, export, baselines, compare, evaluate. On the GPU computer this also
# checks CUDA, mixed precision and (with REHEARSAL_LUNGMASK=1) lungmask on the GPU before the
# real run. Output: work/rehearsal/ (report in work/rehearsal/docs/EVALUATION_REPORT.md).
set -euo pipefail
cd "$(dirname "$0")/.."

cli="${CAVINET_ML:-}"
if [ -z "$cli" ]; then
  for candidate in .venv-train/bin/cavinet-ml .venv/bin/cavinet-ml "$(command -v cavinet-ml || true)"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then cli="$candidate"; break; fi
  done
fi
if [ -z "$cli" ]; then
  echo "cavinet-ml not found: run 'make install-train' (or 'make install') first." >&2
  exit 1
fi

out="${REHEARSAL_DIR:-work/rehearsal}"
rm -rf "$out"
work=(--work "$out/work")
paths=(--work "$out/work" --splits "$out/splits.json")
docs=(--docs "$out/docs")
lungmask=(--no-lungmask)
if [ "${REHEARSAL_LUNGMASK:-0}" = "1" ]; then lungmask=(); fi

step() { echo; echo "==> cavinet-ml $*"; "$cli" "$@"; }
step synthetic-dataset --out "$out/data"
step index --data "$out/data/dicom-dataset.zip" "${work[@]}"
step preprocess "${work[@]}" --workers 2 "${lungmask[@]}"
step split "${paths[@]}" --folds 2
for fold in 0 1; do
  step train --fold "$fold" --config ml/configs/ci.yaml "${paths[@]}"
done
step calibrate "${paths[@]}"
step export "${paths[@]}" "${docs[@]}"
step baseline "${paths[@]}"
step shortcut-check "${paths[@]}"
step compare "${paths[@]}"
step evaluate --split dev "${paths[@]}" "${docs[@]}"
step evaluate --split test "${paths[@]}" "${docs[@]}"
echo
echo "==> A second test evaluation must be refused:"
if "$cli" evaluate --split test "${paths[@]}" "${docs[@]}"; then
  echo "ERROR: the second test evaluation was not refused." >&2
  exit 1
fi
echo
echo "Rehearsal finished. Report: $out/docs/EVALUATION_REPORT.md (synthetic data: the numbers mean nothing)."
