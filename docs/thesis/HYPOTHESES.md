# Hypotheses H1 to H5: outcomes

All tested on the same locked test set of 259 patients (173 TB, 86 NTM), used once per
hypothesis and logged in [../audit/evaluation_runs.jsonl](../audit/evaluation_runs.jsonl).

| | Hypothesis | Outcome | Result | Evidence |
|---|---|---|---|---|
| H1 | The CT model separates TB from NTM better than chance | **Supported** | Test AUC 0.766 (95% CI 0.699 to 0.826); target AUC ≥ 0.75 met | [Report: locked test set](../EVALUATION_REPORT.md#locked-test-set), [ROC](../figures/roc_test.png) |
| H2 | CT adds information beyond demographics and symptoms | **Supported** | CT AUC 0.766 vs clinical-only 0.678: +0.088 (95% CI +0.004 to +0.173), DeLong p = 0.041 | [Report: baselines](../EVALUATION_REPORT.md#clinical-only-baseline-and-shortcut-check), [table 5](../tables/5_baselines.csv) |
| H3 | CT plus symptoms is better than CT alone (optional) | **Not supported** | Combined AUC 0.772 vs CT-only 0.766: +0.006 (95% CI −0.041 to +0.053), DeLong p = 0.80 | [Report: H3](../EVALUATION_REPORT.md#symptom-assisted-prediction-h3), [fusion_results.json](../audit/fusion_results.json) |
| H4 | The heatmap falls mostly inside the lungs (optional) | **Not supported** | Mean share inside the lung mask 33.0% (95% CI 32.1% to 34.0%); target ≥ 80% | [Report: H4](../EVALUATION_REPORT.md#heatmap-explanation-h4), [heatmap_check.json](../audit/heatmap_check.json) |
| H5 | The system is practical to deploy | **Supported** | 297-slice scan analysed in 79 s on a 4-core CPU (budget 180 s); 10 of 10 real scans give the toolkit's probability; all CI acceptance tests pass | [Model verification](../verification/MODEL_VERIFICATION.md), CI "Full stack" job |

Also reported (not a hypothesis): scan metadata alone (manufacturer, kernel, slice thickness)
separates TB from NTM with AUC 0.695 (CI lower bound 0.642). The CT model may partly learn
scanner differences; see [LIMITATIONS.md](LIMITATIONS.md).

**Overall.** The core claim holds: a 3D CNN on routine chest CT separates TB from NTM in unseen
patients (H1) and does better than demographics and symptoms alone (H2), delivered as an
application that runs on an ordinary CPU (H5). The two optional extensions did not reach their
targets: adding symptoms gave no measurable gain on new patients (H3), and the Grad-CAM heatmap
is too coarse to stay within the lungs (H4). Both are reported as measured; the methods were
not changed after seeing the results.
