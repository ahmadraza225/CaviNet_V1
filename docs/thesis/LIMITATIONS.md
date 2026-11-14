# Limitations

1. **One hospital, one dataset.** All 1,297 usable patients come from the Tianjin dataset
   (Kaggle, CC BY 4.0). Performance in other hospitals, scanners or populations, including
   Pakistan, is unknown; local validation is needed before any clinical use.
2. **Possible scanner shortcut.** Scan metadata alone reaches AUC 0.695 on the test set, so part
   of the CT model's signal may reflect scanner or protocol differences between the TB and NTM
   groups rather than disease.
3. **Moderate accuracy.** Test AUC 0.766, sensitivity 74.0%, specificity 64.0%: useful as
   decision support, not as a diagnosis. About a third of NTM patients are called TB at the
   0.5 threshold.
4. **Calibration.** Temperature scaling did not improve the out-of-fold calibration error
   (0.110 before, 0.116 after); probabilities should be read as approximate.
5. **Class imbalance.** Two TB patients for every NTM patient; NTM estimates have wider
   confidence intervals (specificity 95% CI 53.5% to 73.3%).
6. **No lesion labels.** The dataset's cavity annotations are not published, so the model is
   trained on patient-level labels only and cannot locate lesions. The heatmap shows where the
   model looked, not where disease is, and only 33% of it falls inside the lungs (H4).
7. **Symptoms.** Symptom data are binary and recorded once; their gain on development folds
   (AUC 0.716 to 0.767) did not carry over to the test set (H3). The fusion was trained on
   single-fold out-of-fold logits but is applied to the 5-model ensemble logit.
8. **Excluded patients.** Four patients were excluded for missing or conflicting index
   entries; NTM species are not distinguished.
9. **Test set size.** 259 patients give confidence intervals about ±0.06 on the AUC; small
   differences between models (as in H3) cannot be detected.
10. **Not a medical device.** CaviNet is a research prototype. It is not certified and must
    not be used for patient care.
