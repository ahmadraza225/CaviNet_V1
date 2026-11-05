# Model verification

Model model-v1, checked on 2026-11-05 on cloud test computer, 4-core CPU with `scripts/verify_model.py`: each scan was uploaded through the application's API and its probability of TB compared with the training toolkit's (tolerance 0.01).

**10 of 10 scans agree.**

| Patient | Class | Slices | Toolkit | Application | Difference | Agrees | Analysis (s) |
|---|---|---|---|---|---|---|---|
| Case_241 | NTM | 297 | 0.4211 | 0.4211 | 0.0000 | yes | 79 |
| TB_824 | TB | 221 | 0.7391 | 0.7426 | 0.0035 | yes | 44 |
| TB_153 | TB | 289 | 0.3898 | 0.3898 | 0.0000 | yes | 55 |
| TB_029 | TB | 257 | 0.6774 | 0.6774 | 0.0000 | yes | 47 |
| TB_349 | TB | 221 | 0.7597 | 0.7597 | 0.0000 | yes | 37 |
| TB_311 | TB | 253 | 0.5855 | 0.5855 | 0.0000 | yes | 45 |
| Case_142 | NTM | 287 | 0.6045 | 0.6045 | 0.0000 | yes | 35 |
| Case_115 | NTM | 361 | 0.2618 | 0.2618 | 0.0000 | yes | 41 |
| Case_083 | NTM | 451 | 0.3421 | 0.3421 | 0.0000 | yes | 56 |
| Case_380 | NTM | 427 | 0.7131 | 0.7131 | 0.0000 | yes | 38 |

Timing (NFR-1): Case_241, 297 slices, analysed in 79 s on this computer's CPU: within the 180 s budget.
