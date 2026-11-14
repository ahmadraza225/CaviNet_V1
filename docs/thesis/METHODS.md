# Methods: the CaviNet AI pipeline

Written for the thesis methods chapter. Exact settings are in [../MODEL_CARD.md](../MODEL_CARD.md);
the code is the `cavinet-ml` toolkit (`ml/`).

## Data

Mycobacterial CT Imaging Dataset (Tianjin Haihe Hospital, 2014 to 2024; Kaggle
`damianhan/dicom-dataset`, CC BY 4.0): 1,301 chest CT scans labelled TB or NTM, with age, sex
and 12 symptoms in `PatientIndex.xlsx`. Four patients were excluded (missing or conflicting
index entries), leaving 1,297. A locked test set of 259 patients (20%) was set aside before any
training, stratified by label, sex, age band and scanner manufacturer (seed 42); the other 1,038
patients form 5 cross-validation folds with the same stratification.

## Preprocessing (identical in training and in the application)

The largest axial CT series is read; values below −1024 HU are clipped. The lungs are segmented
with lungmask (R231); if the mask is under 500 mL the body outline is used instead and a warning
is recorded. The volume is resampled to 1.5 mm isotropic, cropped to the lungs plus 10 mm,
windowed to −1350 to 150 HU, scaled to 0 to 1 and resized to 128 × 128 × 128 voxels.

## Model and training

A 3D ResNet-18 (MONAI) with one input channel and one output logit, initialised from MedicalNet
weights, dropout 0.3 before the final layer. One model per fold: binary cross-entropy with
class weighting, AdamW (learning rate 1e-4, weight decay 1e-4), 3 warm-up epochs then cosine
decay, up to 60 epochs with early stopping on validation AUC (patience 12), mixed precision,
batch 4 with gradient accumulation to 16. Augmentation: left-right flip, rotation ±10°, scale
0.9 to 1.1, translation ±8 voxels, intensity ±10%, Gaussian noise.

## Inference and calibration

The five fold models form an ensemble: their logits are averaged, divided by a temperature
fitted on the out-of-fold logits (T = 1.195) and turned into the probability of TB. TB is
predicted when p ≥ 0.5; confidence is the probability of the predicted class, banded High
(≥ 80%), Moderate (65 to 79.9%) or Low (shown as Inconclusive).

## Explanation (optional, M-11)

Grad-CAM on the last convolutional block of each fold model, for the predicted class, averaged
over folds and mapped back onto 48 preview slices. H4 measures the share of the heatmap energy
inside the lung mask on the test set.

## Symptom-assisted prediction (optional, M-12)

A logistic regression combines the CT logit (standardised) with age, sex and the 12 symptoms.
It is fitted on the out-of-fold CT logits of the development patients (class-weighted, missing
values imputed from the training data) and applied to the ensemble logit in the application.
H3 compares it with CT alone on the test set.

## Statistics

AUC with 95% confidence intervals from a stratified bootstrap (2,000 resamples, seed 42);
threshold metrics at 0.5; calibration by expected calibration error (10 bins) and Brier score.
Models on the same patients are compared with DeLong's test (two-sided, α = 0.05). Baselines:
a clinical-only logistic regression (age, sex, symptoms; H2) and a metadata-only model
(manufacturer, kernel, slice thickness) as a shortcut check, both on the same folds. The
locked test set is used once per question; every run is logged.

## Software

Python 3.11, PyTorch, MONAI, SimpleITK, lungmask, scikit-learn; application in FastAPI,
PostgreSQL, Redis/RQ and React, run with Docker Compose on a CPU.
