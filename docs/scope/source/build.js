const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, BorderStyle, LevelFormat, Footer, PageNumber,
  TableOfContents, ImageRun,
} = require("docx");

const OUT = process.argv[2] || "CaviNet_Scope_Document_v2.docx";
const LOGO = process.argv[3];
const W = 9026; // A4 content width in DXA with 1" margins
const ACCENT = "1F4E79";
const LIGHT = "DCE6F1";

// ---------- helpers ----------
function runs(text, base = {}) {
  return String(text)
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .filter(Boolean)
    .map((p) => {
      if (p.startsWith("**")) return new TextRun({ ...base, text: p.slice(2, -2), bold: true });
      if (p.startsWith("`")) return new TextRun({ ...base, text: p.slice(1, -1), font: "Consolas", size: 19 });
      return new TextRun({ ...base, text: p });
    });
}
const P = (t, o = {}) => new Paragraph({ children: runs(t), spacing: { after: 120 }, ...o });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(t)] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });
const B = (t, level = 0) => new Paragraph({ numbering: { reference: "bullets", level }, children: runs(t), spacing: { after: 60 } });
const bullets = (arr) => arr.map((t) => (Array.isArray(t) ? B(t[0], 1) : B(t)));
const NOTE = (t) =>
  new Paragraph({
    children: runs(t),
    spacing: { before: 120, after: 160 },
    shading: { type: ShadingType.CLEAR, fill: "FFF4E5", color: "auto" },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: "E39B2B", space: 6 } },
    indent: { left: 120, right: 120 },
  });

function cell(text, width, opts = {}) {
  const lines = String(text).split("\n");
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: lines.map(
      (l) => new Paragraph({ children: runs(l, opts.header ? { bold: true, color: "FFFFFF" } : {}), spacing: { after: 40 } })
    ),
  });
}
function table(headers, rows, ratios) {
  const total = ratios.reduce((a, b) => a + b, 0);
  const widths = ratios.map((r) => Math.floor((W * r) / total));
  widths[widths.length - 1] += W - widths.reduce((a, b) => a + b, 0);
  const border = { style: BorderStyle.SINGLE, size: 4, color: "A6A6A6" };
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: widths,
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, widths[i], { fill: ACCENT, header: true })) }),
      ...rows.map(
        (r, ri) => new TableRow({ children: r.map((c, i) => cell(c, widths[i], { fill: ri % 2 ? "F7F9FC" : undefined })) })
      ),
    ],
  });
}
const gap = () => new Paragraph({ children: [], spacing: { after: 80 } });

function promptBlock(phaseTitle, lines) {
  const out = [
    new Paragraph({
      children: [new TextRun({ text: `Prompt for Claude Code — ${phaseTitle}`, bold: true, color: "FFFFFF" })],
      shading: { type: ShadingType.CLEAR, fill: "2E3B4E", color: "auto" },
      spacing: { before: 160, after: 0 },
      indent: { left: 80, right: 80 },
    }),
  ];
  for (const l of lines) {
    out.push(
      new Paragraph({
        children: [new TextRun({ text: l === "" ? " " : l, font: "Consolas", size: 18 })],
        shading: { type: ShadingType.CLEAR, fill: "F2F2F2", color: "auto" },
        spacing: { after: 0, line: 260 },
        indent: { left: 80, right: 80 },
      })
    );
  }
  out.push(gap());
  return out;
}

// ---------- shared prompt pieces ----------
const PROMPT_HEADER = (n, name) => [
  `You are implementing Phase ${n} (${name}) of CaviNet.`,
  "Source of truth: docs/scope/CaviNet_Scope_Document_v2.md (the approved scope",
  "document and PRD basis). Read it fully before writing code. If anything in this",
  "prompt conflicts with it, the scope document wins; if something is genuinely",
  "ambiguous, stop and ask before guessing.",
  "",
];
const PROMPT_FOOTER = (n, slug) => [
  "",
  "General rules:",
  "- Work only inside the phase scope; do not start later phases.",
  "- Write automated tests for everything you build; all CI jobs must pass.",
  "- Update CHANGELOG.md and any docs this phase touches.",
  "- No real patient data and no dataset files are committed to git.",
  "",
  "Git:",
  `- Commit on branch phase-${String(n).padStart(2, "0")}-${slug} (or the branch this`,
  "  session assigns), with clear commit messages, and push.",
  `- Open a pull request titled "Phase ${String(n).padStart(2, "0")} — ${slug.replace(/-/g, " ")}" whose body`,
  "  lists every acceptance criterion from section 15 as a checkbox, ticked only",
  "  if you verified it, with the command/output that proves it.",
  "- Finish by reporting: what was built, test results, anything not done and why.",
];

// ---------- content ----------
const children = [];

// Cover
if (LOGO && fs.existsSync(LOGO)) {
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 200 },
      children: [new ImageRun({ type: "png", data: fs.readFileSync(LOGO), transformation: { width: 119, height: 104 } })],
    })
  );
}
children.push(
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 120 }, children: [new TextRun({ text: "CAVINET", bold: true, size: 64, color: ACCENT })] }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: "AI-Based Differentiation of Pulmonary Tuberculosis and Non-Tuberculous Mycobacterial Lung Disease on Chest CT", size: 30, bold: true })],
  }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "Project Scope Document — Revised (Version 2.0)", size: 26 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: "Also serves as the PRD basis and the phased implementation plan for Claude Code", italics: true, size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "Final Year Project | Session 2025 to 2027", size: 24 })] }),
  table(["Student Name", "Registration Number"], [["Mahnoor Iqbal", "230910"], ["Khudema Haroon", "232942"], ["Ahmed Raza", "230958"]], [3, 2]),
  gap(),
  table(
    ["Role", "Name"],
    [["Supervisor", "Sohaib Masood"], ["Co-Supervisor", "Kanwal Ejaz"], ["Department", "Computer Science"], ["University", "Air University, Islamabad"]],
    [2, 3]
  ),
  gap(),
  table(
    ["Version", "Date", "Change"],
    [
      ["1.0", "March 2026", "Original scope: TB cavity detection with heatmaps (10 modules)."],
      ["2.0", "October 2026", "Revised after dataset investigation: no public cavity annotations exist for the chosen dataset. Objective changed to TB vs NTM differentiation with a calibrated confidence score. Added PRD-level requirements and a 12-phase implementation plan executed by Claude Code. Implementation repository: github.com/ahmadraza225/CaviNet_V1."],
    ],
    [1, 2, 7]
  )
);

// Meeting log
children.push(
  H1("Supervisor Meeting Log"),
  table(
    ["Meeting", "Discussion", "Task Assigned", "Signature"],
    [
      ["Meeting 01\n18/02/2026", "New FYP ideas, feasibility, constraints", "Write initial proposal", ""],
      ["Meeting 02\n27/02/2026", "Idea confirmation, discussed the flow", "Finalize the tools and technologies", ""],
      ["Meeting 03\n12/03/2026", "Modules to include, stack selection", "Finalize the modules", ""],
      ["Meeting 04\n__/10/2026", "Revised scope v2.0: dataset findings, TB vs NTM objective, phased plan", "Approve revised scope", ""],
    ],
    [2, 4, 3, 2]
  ),
  new Paragraph({ children: [], spacing: { after: 200 } }),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Table of Contents")] }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" })
);

// 1. Introduction
children.push(
  H1("1. Introduction"),
  P("Tuberculosis (TB) remains one of the world's deadliest infectious diseases, and Pakistan carries one of the highest TB burdens globally. A closely related group of infections, **non-tuberculous mycobacterial (NTM) lung disease**, produces symptoms and chest CT appearances that are very similar to TB. The two are frequently confused, yet they need completely different treatment: anti-TB drugs do not cure most NTM infections, and NTM is sometimes misdiagnosed as drug-resistant TB. Laboratory confirmation (culture, molecular tests) is slow, so doctors often have to decide on initial management from imaging and clinical signs."),
  P("**CaviNet** is a web-based clinical decision-support system. A doctor uploads a patient's chest CT scan (DICOM), and the system returns whether the scan looks more like **TB** or **NTM**, together with a **calibrated confidence score**, a plain-language explanation of what the score means, and a downloadable PDF report. The AI model is a 3D convolutional neural network trained on 1,301 real chest CT scans from the public Tianjin Mycobacterial CT Imaging Dataset."),
  P("All technical implementation (backend, frontend, AI pipeline, training toolkit, tests and technical documentation) is carried out by **Claude Code**, an AI coding agent, working phase by phase from the prompts in Section 15. The student team directs the work, runs model training on the team's GPU computer, reviews and accepts every phase against written acceptance criteria, and writes the thesis."),
  NOTE("**Name note:** the project keeps the name CaviNet for continuity. Version 2.0 no longer detects cavities; Section 2 explains why.")
);

// 2. Why revised
children.push(
  H1("2. Why the Scope Was Revised"),
  P("Version 1.0 planned to detect and localize TB cavities with heatmaps. A detailed investigation of public datasets in October 2026 found that this cannot be achieved with data the team can actually obtain:"),
  ...bullets([
    "The datasets listed in v1.0 were unsuitable: NIH TB and MIMIC-CXR are chest **X-rays**, not CT, and LIDC-IDRI contains lung-nodule (cancer) labels, not cavities.",
    "Datasets with cavity annotations (ImageCLEF Tuberculosis, DeepPulmoTB, TB Portals) require signed agreements, requests to organizers, or paid subscriptions, which the team cannot rely on.",
    "The chosen open dataset (Tianjin Mycobacterial CT, Kaggle, CC BY 4.0) contains 1,301 chest CTs labelled **TB or NTM**, plus age, sex, symptoms and NTM species. Its lesion (cavity) annotations are **not published**: the patient index only flags that 239 patients were annotated.",
  ]),
  P("Without cavity labels, no model can be trained to find cavities. The labels that do exist support a different, clinically meaningful task: **differentiating TB from NTM**. This revision therefore:"),
  ...bullets([
    "changes the core output to **TB vs NTM + calibrated confidence score**;",
    "removes cavity detection, segmentation and localization;",
    "removes the Adaptive Learning module (no reliable stream of confirmed labels during the project);",
    "keeps a **heatmap** (regions that influenced the prediction) and **symptom-assisted prediction** as **optional** final phases;",
    "uses **only** the open Kaggle dataset and freely downloadable pretrained models. No emails, data requests or agreements are needed.",
  ])
);

// 3. Problem statement
children.push(
  H1("3. Problem Statement"),
  P("TB and NTM lung disease look alike on chest CT and present with similar symptoms. Distinguishing them requires laboratory tests that take days to weeks, and expert chest radiologists are scarce in many hospitals. Misclassification leads to wrong treatment, unnecessary drug toxicity, and delayed effective therapy."),
  P("There is no locally deployable, easy-to-use tool that gives doctors an objective, explainable estimate of whether a mycobacterial infection on CT is more likely TB or NTM, with an honest measure of how confident that estimate is. CaviNet addresses this gap as a **decision-support** tool: it supports, and never replaces, clinical judgment and laboratory confirmation.")
);

// 4. Thesis
children.push(
  H1("4. Thesis Statement and Research Hypotheses"),
  H2("4.1 Proposed Thesis Title"),
  P("**CaviNet: A Deep Learning Decision-Support System for Differentiating Pulmonary Tuberculosis from Non-Tuberculous Mycobacterial Lung Disease on Chest CT**"),
  H2("4.2 Thesis Statement"),
  P("A three-dimensional convolutional neural network trained on routine chest CT can differentiate pulmonary tuberculosis from non-tuberculous mycobacterial lung disease in previously unseen patients with clinically meaningful accuracy, chest CT carries diagnostic information beyond patient demographics and symptoms, and such a model can be delivered to clinicians as a privacy-preserving, explainable web application that runs on ordinary hardware."),
  H2("4.3 Hypotheses Tested"),
  table(
    ["ID", "Hypothesis", "How it is tested", "Phase"],
    [
      ["H1", "The CT model distinguishes TB from NTM better than chance, reaching the target accuracy.", "AUC on the locked test set (never used in training) with 95% bootstrap confidence interval. Supported if the lower CI bound > 0.50; target AUC ≥ 0.75.", "8"],
      ["H2", "Chest CT adds information beyond demographics and symptoms.", "Compare the CT model's AUC with a clinical-only model (age, sex, 12 symptoms) on the same patients using DeLong's test (p < 0.05).", "8–9"],
      ["H3 (optional)", "Combining CT with symptoms is better than CT alone.", "AUC of the combined model vs CT-only model on the locked test set (DeLong).", "11"],
      ["H4 (optional)", "The model bases its decisions on the lungs, not on irrelevant image regions.", "Share of Grad-CAM heatmap energy that falls inside the lung mask, averaged over the test set (target ≥ 80%).", "10"],
      ["H5", "The system is practical to deploy.", "End-to-end analysis ≤ 3 minutes per scan on a standard laptop CPU; all acceptance tests pass.", "7–9"],
    ],
    [1.3, 3.2, 4.5, 1]
  ),
  gap(),
  H2("4.4 Additional Validity Checks"),
  ...bullets([
    "**Shortcut check:** a model given only scan metadata (scanner make, kernel, slice thickness) is trained on the same splits; if it predicts TB/NTM well, the CT model may be learning scanner differences rather than disease. Results are reported either way.",
    "**Subgroup results:** AUC reported separately by sex, age band (< 40, 40–59, ≥ 60) and scanner manufacturer.",
    "**Calibration:** reliability diagram, Brier score and expected calibration error show whether a stated confidence of 80% really means about 80% correct.",
  ]),
  H2("4.5 What the Thesis Cannot Claim"),
  ...bullets([
    "It cannot claim to diagnose TB. It estimates TB vs NTM for patients already suspected of mycobacterial lung disease.",
    "It cannot claim to detect or locate cavities or other lesions.",
    "It cannot claim performance on healthy people or other diseases (none are in the data), or on other hospitals (single-centre data).",
  ]),
  NOTE("**If H1 is not supported** (the model cannot reliably separate TB from NTM), the thesis remains valid as an evaluation study: a rigorously measured negative result plus a working, deployable system. The evaluation in Phase 8 is designed so that either outcome is reported honestly.")
);

// 5. Objectives
children.push(
  H1("5. Objectives and Success Criteria"),
  H2("5.1 Core Objectives (must be achieved)"),
  table(
    ["#", "Objective", "Measurable success criterion"],
    [
      ["O1", "Build a reproducible data pipeline that processes all 1,301 CT scans of the Tianjin dataset.", "Manifest of 1,301 patients; ≥ 98% of scans preprocessed successfully; failures listed with reasons; patient-level split file saved."],
      ["O2", "Train a 3D CNN that classifies a chest CT as TB or NTM and save it as a single .pth model file.", "Model bundle exported per Section 11.6 and published as a GitHub Release asset."],
      ["O3", "Produce a calibrated confidence score for every prediction.", "Temperature scaling fitted on out-of-fold predictions; expected calibration error reported; confidence bands per Section 11.5."],
      ["O4", "Evaluate the model honestly on patients it has never seen.", "Locked test set (20%) evaluated exactly once; AUC with 95% CI, sensitivity, specificity, PPV, NPV, accuracy, F1, Brier score, confusion matrix, subgroup and shortcut checks."],
      ["O5", "Show whether CT adds value beyond clinical data.", "Clinical-only baseline trained on identical splits; DeLong comparison reported."],
      ["O6", "Deliver a web application covering modules M-01 to M-10.", "All functional requirements in Section 10 pass their acceptance tests; end-to-end test passes."],
      ["O7", "Make the system runnable on a team laptop with one command.", "`make up` (Docker Compose) starts the whole system; analysis ≤ 3 min per scan on CPU."],
      ["O8", "Document the system for users, developers and examiners.", "User manual, developer guide, training runbook, model card and evaluation report in docs/."],
    ],
    [0.7, 4.3, 5]
  ),
  gap(),
  H2("5.2 Optional Objectives (only after the core is complete)"),
  table(
    ["#", "Objective", "Success criterion"],
    [
      ["O9", "Heatmap explanation: show which lung regions most influenced each prediction (Phase 10).", "Grad-CAM overlay in the viewer and PDF; ≥ 80% average heatmap energy inside lungs on the test set (H4)."],
      ["O10", "Symptom-assisted prediction: combine the CT result with age, sex and symptoms entered by the doctor (Phase 11).", "Combined model evaluated on the locked test set and compared with CT-only (H3); UI shows both results."],
    ],
    [0.7, 5, 4.3]
  ),
  gap(),
  H2("5.3 Performance Targets"),
  ...bullets([
    "**Primary:** test-set AUC ≥ 0.75 with the 95% CI lower bound above 0.50.",
    "**Secondary:** CT model AUC higher than the clinical-only baseline (DeLong p < 0.05).",
    "**Reference point:** the only published study on this dataset (whole-lung radiomics with a linear classifier) reported AUC ≈ 0.79 on the Chinese cohort. Matching or exceeding this is a strong result; claims above 0.85 are not expected.",
  ])
);

// 6. Scope
children.push(
  H1("6. Scope"),
  H2("6.1 In Scope"),
  table(
    ["Area", "What is included"],
    [
      ["Web application", "React web portal with login, dashboard, patient management, CT upload, results, PDF reports, notifications and administration (M-01 to M-09)."],
      ["Authentication and roles", "Secure login, two roles (Doctor, Admin), session timeout, account lockout, admin-managed password resets."],
      ["CT upload", "DICOM upload (zip or multiple .dcm files), validation, automatic series selection, de-identification on arrival."],
      ["AI analysis", "Preprocessing, automatic lung segmentation (pretrained), 3D CNN ensemble, calibrated TB/NTM probability and confidence band."],
      ["Training toolkit", "Command-line tools to index, preprocess, split, train, calibrate, evaluate and export the model (M-10)."],
      ["Evaluation", "Locked test set, cross-validation, clinical baseline, shortcut and subgroup checks, calibration analysis."],
      ["Reports", "Auto-generated PDF report with result, confidence explanation, representative CT slices and disclaimer."],
      ["Deployment", "One-command Docker Compose deployment on a team laptop (Windows, macOS or Linux)."],
      ["Optional", "Heatmap explanation (M-11) and symptom-assisted prediction (M-12)."],
    ],
    [2.2, 7.8]
  ),
  gap(),
  H2("6.2 Out of Scope"),
  table(
    ["Area", "Reason"],
    [
      ["Cavity / lesion detection, segmentation or localization", "No lesion annotations are publicly available for the dataset."],
      ["TB vs healthy screening; other lung diseases", "The dataset contains only TB and NTM patients."],
      ["Definitive TB diagnosis", "TB is confirmed by laboratory tests; CaviNet is decision support only."],
      ["Adaptive / continuous learning from doctor feedback", "Removed in v2.0: no reliable stream of confirmed labels during the project."],
      ["NTM species identification", "Too few labelled cases per species for a reliable model."],
      ["Chest X-ray, PNG/JPG input", "Only CT in DICOM format is supported; PNG/JPG lose the CT density (Hounsfield) values."],
      ["Mobile apps, cloud hosting, EHR/HIS/PACS integration, email/SMS", "Not needed for a laptop-based academic prototype."],
      ["Multi-hospital (multi-tenant) operation", "Single-site prototype."],
      ["Regulatory approval", "Research prototype; not a medical device."],
    ],
    [3.5, 6.5]
  )
);

// 7. Dataset
children.push(
  H1("7. Dataset"),
  H2("7.1 Source"),
  table(
    ["Property", "Value"],
    [
      ["Name", "Mycobacterial CT Imaging Dataset (Tianjin Haihe Hospital, China, 2014–2024)"],
      ["Publication", "\"An Integrated Mycobacterial CT Imaging Dataset with Multispecies Information\", Scientific Data, 2025"],
      ["Kaggle (used)", "`damianhan/dicom-dataset`: original DICOM, about 92 GB, licence CC BY 4.0"],
      ["Kaggle (not used)", "`damianhan/nifti-dataset`: preprocessed NIfTI (about 195 GB) and 3 preprocessing scripts. Not needed; CaviNet preprocesses from DICOM."],
      ["Access", "Free Kaggle account and API token. No request or agreement required."],
      ["Patients", "**1,301**: 871 TB (`TB/TB_001` … `TB_871`) and 430 NTM (`NTM/Case_001` … `Case_430`); one folder of axial CT slices per patient."],
      ["Index file", "`PatientIndex.xlsx`: sheets TB and NTM; columns: Number, Gender (1 = male, 2 = female), Age, 12 symptoms (Chest pain, Cough, Expectoration, Fever, Chest tightness, Haemoptysis, Gasp, Dyspnoea, Chills, Fatigue, Night sweats, Weight loss; 1 = present, blank = absent), Annotation Status, Strain Type (NTM only). The TB sheet ends with legend rows that must be ignored."],
    ],
    [2, 8]
  ),
  gap(),
  H2("7.2 Known Characteristics (from the October 2026 sample audit)"),
  ...bullets([
    "Mixed scanners (e.g. GE BrightSpeed, Toshiba Aquilion ONE), kernels and slice thickness (about 1.0–1.25 mm in the sample); 512 × 512 matrix.",
    "Some files are **JPEG-Lossless compressed** (need SimpleITK/GDCM or pylibjpeg to decode).",
    "**PatientID and PatientName are blank**: patients are identified by folder name. Sex, age and institution name remain in headers.",
    "File-name order differs from slice order: slices must be sorted by `ImagePositionPatient`.",
    "Pixels outside the scan circle hold −3024 or −2048: clipped to −1024 HU during preprocessing.",
    "Groups differ in demographics: median age TB 49 vs NTM 59; male TB 72% vs NTM 62%. This is why the clinical baseline and shortcut checks exist.",
    "Class balance: 67% TB / 33% NTM, handled with class weighting and stratified splits.",
  ]),
  H2("7.3 How the Data Is Used"),
  table(
    ["Use", "Detail"],
    [
      ["Label", "TB = 1, NTM = 0 (from folder name, cross-checked with PatientIndex.xlsx)."],
      ["Locked test set", "20% of patients (about 260), stratified by label, sex, age band and scanner manufacturer, fixed with seed 42. Used exactly once, after the model is frozen."],
      ["Development set", "Remaining 80% (about 1,041): 5-fold stratified cross-validation for training, model selection and calibration."],
      ["Clinical features", "Age, sex and the 12 symptoms: used by the clinical baseline (Phase 8) and the optional symptom-assisted model (Phase 11)."],
      ["Not used", "Strain Type (out of scope), Annotation Status (no annotation files exist)."],
    ],
    [2, 8]
  ),
  gap(),
  P("The dataset must be cited in the thesis and README (CC BY 4.0 attribution). Dataset files are never committed to the GitHub repository.")
);

// 8. Related work
children.push(
  H1("8. Related Work"),
  table(
    ["Work / system", "What it does", "Gap CaviNet addresses"],
    [
      ["Kanagala et al., medRxiv 2026 (same dataset)", "Whole-lung radiomics (85 hand-crafted features) with a linear classifier for NTM vs TB; AUC ≈ 0.79 on the Chinese cohort.", "Uses hand-crafted features and no deployable tool. CaviNet learns features end-to-end with a 3D CNN, adds calibrated confidence and delivers a working clinical application."],
      ["Radiomics and deep-learning NTM vs TB studies (e.g. Frontiers in Medicine 2026, Eur. Radiol. studies)", "Research models, mostly on private hospital data, often requiring manual lesion outlining.", "CaviNet needs no manual outlining, uses only public data, and is fully reproducible."],
      ["CAD4TB, qXR, Lunit INSIGHT CXR", "Commercial TB screening tools for chest X-ray.", "Do not address CT or TB vs NTM differentiation."],
      ["Haq et al., Symmetry 2022", "TB-positive vs negative on CT using GLCM texture features and classical ML on 200 images.", "Small, single-task, no TB vs NTM, no calibration or deployment."],
    ],
    [2.6, 3.7, 3.7]
  )
);

// 9. System overview
children.push(
  H1("9. System Overview"),
  H2("9.1 Architecture"),
  table(
    ["Component", "Technology", "Responsibility"],
    [
      ["Web frontend", "React + TypeScript (served by nginx)", "All screens; talks only to the backend API."],
      ["Backend API", "Python FastAPI", "Authentication, authorization, patients, uploads, cases, results, reports, notifications, audit log."],
      ["Database", "PostgreSQL", "Users, patients, scans/cases, results, notifications, audit log."],
      ["Job queue", "Redis + RQ", "Queues analysis jobs so uploads return immediately."],
      ["AI worker", "Python (PyTorch, MONAI, SimpleITK, lungmask)", "Validates and preprocesses scans, runs the model, stores results and preview images."],
      ["File storage", "Local Docker volume", "De-identified DICOM, preprocessed volumes, preview images, PDF reports."],
      ["Model file", "`models/cavinet_model.pth` (downloaded from a GitHub Release)", "Trained ensemble + calibration + preprocessing settings."],
      ["Training toolkit", "Python CLI `cavinet-ml` (runs on the GPU computer)", "Index, preprocess, split, train, calibrate, evaluate, export."],
    ],
    [2.2, 3.3, 4.5]
  ),
  gap(),
  H2("9.2 Doctor's Journey"),
  ...bullets([
    "Log in → Dashboard shows recent cases and their status.",
    "Open or create the patient → click **Upload CT** → select a zip or the .dcm files → upload with progress bar.",
    "Case moves through: Uploaded → Validating → Queued → Preprocessing → Analysing → Completed (or Failed with a reason). A notification appears when it completes.",
    "Open the result: **TB** or **NTM**, probability of TB, confidence band (High / Moderate / Low), plain-language explanation, slice viewer, model version and disclaimer.",
    "Download the PDF report.",
  ]),
  H2("9.3 Roles and Permissions"),
  table(
    ["Capability", "Doctor", "Admin"],
    [
      ["Log in, change own password", "Yes", "Yes"],
      ["Create / view / edit / delete patients", "Yes", "No"],
      ["Upload CT scans, view results, download reports", "Yes", "No"],
      ["Receive case notifications", "Yes", "No"],
      ["Create / deactivate users, assign roles, reset passwords", "No", "Yes"],
      ["View audit log and model information", "No", "Yes"],
    ],
    [6, 2, 2]
  ),
  gap(),
  P("Admins deliberately have no access to patient data (least-privilege principle). All authorization is enforced by the backend, not only hidden in the UI.")
);

// 10. Functional requirements
const FR = (id, text) => [id, text];
children.push(
  H1("10. Functional Requirements by Module"),
  P("Each requirement has an ID used in tests, pull requests and the traceability matrix (docs/TRACEABILITY.md). **M-01 to M-10 are core; M-11 and M-12 are optional.**"),
  table(
    ["ID", "Module", "Phase", "Status"],
    [
      ["M-01", "Accounts and Role-Based Access", "2", "Core"],
      ["M-02", "Doctor Dashboard", "3", "Core"],
      ["M-03", "Patient Management", "3", "Core"],
      ["M-04", "CT Scan Upload and De-identification", "4", "Core"],
      ["M-05", "AI Analysis Pipeline (inference)", "5", "Core"],
      ["M-06", "Result and Decision Support", "5", "Core"],
      ["M-07", "Diagnostic PDF Report", "7", "Core"],
      ["M-08", "Notifications and Case Workflow", "4", "Core"],
      ["M-09", "Administration and Audit Log", "2", "Core"],
      ["M-10", "Model Training and Evaluation Toolkit (offline)", "6, 8", "Core"],
      ["M-11", "Heatmap Explanation", "10", "Optional"],
      ["M-12", "Symptom-Assisted Prediction", "11", "Optional"],
    ],
    [1, 5, 1.5, 1.5]
  )
);

const modules = [
  ["M-01: Accounts and Role-Based Access", [
    FR("FR-01.1", "Users log in with email and password. Passwords are hashed with Argon2id; minimum 10 characters including a letter and a digit."),
    FR("FR-01.2", "Successful login issues a 30-minute access token (JWT) and an 8-hour refresh token in an httpOnly cookie; logout revokes the refresh token."),
    FR("FR-01.3", "Two roles: Doctor and Admin (Section 9.3). Every API endpoint checks the role server-side; unauthorized requests return 403."),
    FR("FR-01.4", "After 5 failed logins an account is locked for 15 minutes."),
    FR("FR-01.5", "The frontend logs the user out after 30 minutes of inactivity."),
    FR("FR-01.6", "No email server: an admin resets a password by setting a temporary one; the user must change it at next login."),
    FR("FR-01.7", "The first admin account is created from environment variables on first start."),
  ]],
  ["M-02: Doctor Dashboard", [
    FR("FR-02.1", "Shows counts: total patients, scans uploaded in the last 7 days, cases in progress, completed cases, failed cases."),
    FR("FR-02.2", "Shows the 10 most recent cases (patient, upload time, status, result if complete) with links."),
    FR("FR-02.3", "Has an \"Upload CT\" shortcut and a patient search box."),
  ]],
  ["M-03: Patient Management", [
    FR("FR-03.1", "Patient fields: full name (required), hospital MR number (required, unique), date of birth (required), sex (male/female, required), phone (optional), notes (optional)."),
    FR("FR-03.2", "Doctors can create, view, edit and delete patients; deletion requires confirmation and permanently removes the patient's scans, results, files and reports."),
    FR("FR-03.3", "Patient list with search by name or MR number, sorting and pagination (20 per page)."),
    FR("FR-03.4", "Patient detail page lists all scans with date, status and result."),
  ]],
  ["M-04: CT Scan Upload and De-identification", [
    FR("FR-04.1", "Accepts one .zip (any folder structure) or multiple .dcm files for one patient; maximum total size 1.5 GB; shows an upload progress bar."),
    FR("FR-04.2", "Validation: files are DICOM; Modality = CT; axial orientation; ≥ 50 slices; consistent rows/columns; slice spacing ≤ 5 mm. Failures give a clear human-readable reason."),
    FR("FR-04.3", "If several series are present, the one with the most slices is used (same rule as the dataset authors); the choice is recorded."),
    FR("FR-04.4", "De-identification on arrival: names, IDs, birth date, addresses, institution, physicians, accession numbers and private tags are removed (DICOM PS3.15 basic profile subset) before files are stored. Only de-identified files are kept."),
    FR("FR-04.5", "Stored scan metadata: study date, number of slices, slice thickness, pixel spacing, manufacturer, model, kernel."),
    FR("FR-04.6", "After successful validation, an analysis job is queued automatically."),
  ]],
  ["M-05: AI Analysis Pipeline (inference)", [
    FR("FR-05.1", "Implements the preprocessing in Section 11.1 exactly as used in training (shared code in the `cavinet_ml` package)."),
    FR("FR-05.2", "Runs the model ensemble, applies temperature scaling and produces the probability of TB (Section 11.5)."),
    FR("FR-05.3", "Generates 48 evenly spaced axial preview slices (lung window, PNG) for the viewer and 3 representative slices for the report."),
    FR("FR-05.4", "Records model version, processing time and any warnings (e.g. lung segmentation fallback used)."),
    FR("FR-05.5", "If preprocessing or inference fails, the case is marked Failed with the reason; the worker retries once for transient errors."),
    FR("FR-05.6", "Until the real model exists, a clearly labelled demo model (trained on synthetic data) is used and every screen and report shows \"DEMO MODEL: NOT FOR CLINICAL USE\"."),
  ]],
  ["M-06: Result and Decision Support", [
    FR("FR-06.1", "Shows predicted class (TB or NTM), probability of TB (0–100%), confidence (probability of the predicted class) and confidence band (Section 11.5)."),
    FR("FR-06.2", "Shows a plain-language explanation, e.g. \"The scan pattern is more consistent with TB (confidence: High, 86%). Confirm with laboratory testing.\" Low band shows \"Inconclusive: the model is not confident\"."),
    FR("FR-06.3", "Shows the model's validated performance (test AUC, sensitivity, specificity) from the model card, and the fixed disclaimer: \"Decision support only. Not a diagnosis. Confirm with laboratory tests.\""),
    FR("FR-06.4", "Includes a slice viewer with a slider over the 48 preview slices."),
  ]],
  ["M-07: Diagnostic PDF Report", [
    FR("FR-07.1", "One-click PDF download for completed cases."),
    FR("FR-07.2", "Contents: CaviNet header, report date, patient name, MR number, age, sex, scan details, result, probability, confidence band with explanation, 3 representative slices, model version and validated performance, disclaimer, and a signature line for the reviewing doctor."),
    FR("FR-07.3", "Report downloads are recorded in the audit log."),
  ]],
  ["M-08: Notifications and Case Workflow", [
    FR("FR-08.1", "Case statuses: Uploaded → Validating → Queued → Preprocessing → Analysing → Completed / Failed, each with a timestamp shown as a timeline."),
    FR("FR-08.2", "In-app notification (bell icon with unread count) to the uploading doctor when a case completes or fails; the UI checks every 10 seconds."),
    FR("FR-08.3", "Notifications can be marked read individually or all at once."),
  ]],
  ["M-09: Administration and Audit Log", [
    FR("FR-09.1", "Admin can create users, assign role, deactivate/reactivate users and reset passwords (FR-01.6)."),
    FR("FR-09.2", "Audit log records: login success/failure, logout, user management actions, patient create/edit/delete, upload, result view, report download (who, what, when; no medical content)."),
    FR("FR-09.3", "Admin can view and filter the audit log (by user, action, date)."),
    FR("FR-09.4", "Admin can view model information: version, training date, demo/real flag, validated metrics."),
  ]],
  ["M-10: Model Training and Evaluation Toolkit (offline)", [
    FR("FR-10.1", "`cavinet-ml index`: reads the Kaggle zip or extracted folder plus PatientIndex.xlsx and writes manifest.csv (case ID, label, age, sex, symptoms, slices, thickness, manufacturer, kernel)."),
    FR("FR-10.2", "`cavinet-ml preprocess`: applies Section 11.1 to every case, processing the zip patient by patient without extracting it all; resumable; writes cached volumes and a QC report."),
    FR("FR-10.3", "`cavinet-ml split`: creates the locked test set and 5 folds (Section 11.3) and saves splits.json."),
    FR("FR-10.4", "`cavinet-ml train --fold k`: trains one fold per Section 11.4 with checkpoints, resume, early stopping and logs."),
    FR("FR-10.5", "`cavinet-ml calibrate`: collects out-of-fold predictions and fits temperature scaling."),
    FR("FR-10.6", "`cavinet-ml export`: writes the model bundle (Section 11.6) and model_card.json."),
    FR("FR-10.7", "`cavinet-ml evaluate --split test`: runs the full evaluation (Section 11.7); refuses to run twice on the test split unless forced, and logs every run."),
    FR("FR-10.8", "`cavinet-ml baseline`, `shortcut-check` and `compare`: clinical-only model, metadata-only model and DeLong comparisons on identical splits."),
  ]],
  ["M-11 (optional): Heatmap Explanation", [
    FR("FR-11.1", "Grad-CAM computed on the last convolutional block of each fold model, averaged and mapped back onto the preview slices."),
    FR("FR-11.2", "Viewer toggle to overlay the heatmap; the 3 slices with the highest heatmap share are highlighted and included in the PDF."),
    FR("FR-11.3", "Label: \"Regions that most influenced the prediction. This is not a lesion marker.\""),
    FR("FR-11.4", "Evaluation: share of heatmap energy inside the lung mask, averaged over the test set (H4)."),
  ]],
  ["M-12 (optional): Symptom-Assisted Prediction", [
    FR("FR-12.1", "At upload, the doctor may tick which of the 12 dataset symptoms are present; age and sex come from the patient record."),
    FR("FR-12.2", "A logistic-regression fusion model combines the CT model output with age, sex and symptoms; trained on out-of-fold predictions, evaluated on the locked test set."),
    FR("FR-12.3", "The result page and PDF show both the CT-only and the combined result; if no symptoms are entered, only CT-only is shown."),
  ]],
];
for (const [title, reqs] of modules) {
  children.push(H2(title), table(["ID", "Requirement"], reqs, [1.3, 8.7]), gap());
}

// 11. AI spec
children.push(
  H1("11. AI Model Specification"),
  H2("11.1 Preprocessing (identical in training and in the app)"),
  table(
    ["Step", "Specification"],
    [
      ["1. Load", "Read the DICOM series with SimpleITK (GDCM, handles JPEG-Lossless); sort slices by position; convert to Hounsfield units using RescaleSlope/Intercept."],
      ["2. Clean", "Clip values below −1024 HU (scanner padding) to −1024."],
      ["3. Lung mask", "Pretrained `lungmask` U-Net (R231) on the original volume. If the mask is empty or < 0.5 L, fall back to a body-threshold crop and record a warning."],
      ["4. Resample", "Resample image (linear) and mask (nearest neighbour) to 1.5 × 1.5 × 1.5 mm."],
      ["5. Crop", "Crop to the lung bounding box plus a 10 mm margin."],
      ["6. Window", "Lung window: clip to [−1350, 150] HU and scale to [0, 1]."],
      ["7. Resize", "Resize to 128 × 128 × 128 voxels (trilinear); store as float16."],
    ],
    [1.6, 8.4]
  ),
  gap(),
  H2("11.2 Model"),
  ...bullets([
    "3D ResNet-18 (MONAI), 1 input channel, 1 output logit (TB vs NTM), dropout 0.3 before the final layer.",
    "Initialized from MedicalNet weights pretrained on 3D medical CT when available; otherwise trained from scratch (the choice is recorded in the model card).",
    "Final model: ensemble of the 5 cross-validation fold models (logits averaged).",
  ]),
  H2("11.3 Data Split"),
  ...bullets([
    "Locked test set: 20% of patients, stratified by label × sex × age band (< 40, 40–59, ≥ 60) × scanner manufacturer, seed 42.",
    "Remaining 80%: 5-fold cross-validation with the same stratification.",
    "Splits are by patient (one scan per patient) and saved in splits.json, committed to the repo (it contains only case IDs).",
  ]),
  H2("11.4 Training"),
  table(
    ["Setting", "Value"],
    [
      ["Loss", "Binary cross-entropy with logits; positive class TB; pos_weight = (#NTM / #TB) of the training fold."],
      ["Optimizer", "AdamW, learning rate 1e-4, weight decay 1e-4; cosine schedule with 3 warm-up epochs."],
      ["Epochs", "Maximum 60; early stopping on validation AUC, patience 12; best checkpoint kept."],
      ["Batch", "4 per step with mixed precision (AMP) and gradient accumulation to an effective 16 (fits 8 GB GPU memory); automatically reduced if memory is short."],
      ["Augmentation (training only)", "Left-right flip (p = 0.5); rotation ±10°; scaling 0.9–1.1; translation ±8 voxels; intensity scale ±10%; Gaussian noise σ = 0.01."],
      ["Reproducibility", "Seed 42; config saved as YAML with every run; manifest hash and git commit recorded."],
      ["Logs", "TensorBoard and CSV logs per fold; training curves exported as PNG for the thesis."],
    ],
    [2.5, 7.5]
  ),
  gap(),
  H2("11.5 Calibration, Prediction and Confidence"),
  ...bullets([
    "Temperature scaling fitted on the out-of-fold logits of the development set.",
    "p = calibrated probability of TB. Predicted class = **TB if p ≥ 0.50, otherwise NTM**.",
    "Confidence = p for TB predictions, 1 − p for NTM predictions (always between 50% and 100%).",
    "Confidence band: **High** ≥ 80%; **Moderate** 65–79%; **Low** < 65%, shown as \"Inconclusive\".",
    "Evaluation also reports metrics at the Youden-optimal threshold for reference; the app always uses 0.50.",
  ]),
  H2("11.6 Model File (.pth bundle)"),
  P("A single file `cavinet_model.pth`, loadable with `torch.load(..., weights_only=True)`, containing only tensors and plain values:"),
  ...bullets([
    "`format_version`, `model_name`, `created_at`, `git_commit`, `is_demo` (true/false);",
    "`architecture` (name and parameters) and `fold_state_dicts` (5 state dicts, stored in float16, about 330 MB in total);",
    "`temperature`, `decision_threshold` (0.5), `confidence_bands`;",
    "`preprocessing` (all Section 11.1 parameters) and `label_map` ({1: \"TB\", 0: \"NTM\"});",
    "`metrics` (out-of-fold and locked-test results) and `data_manifest_sha256`.",
  ]),
  P("The bundle is too large for git; it is published as a **GitHub Release asset**, and `make fetch-model` downloads it into `models/`. A matching `model_card.json` / docs/MODEL_CARD.md documents data, training, performance, limitations and intended use."),
  H2("11.7 Evaluation"),
  ...bullets([
    "Cross-validation: per-fold and pooled out-of-fold AUC.",
    "Locked test set (once): AUC with 95% bootstrap CI (2,000 resamples), ROC curve, sensitivity, specificity, PPV, NPV, accuracy, balanced accuracy, F1, confusion matrix, Brier score, expected calibration error, reliability diagram.",
    "Clinical-only baseline (logistic regression on age, sex, 12 symptoms) and DeLong comparison (H2).",
    "Shortcut check: metadata-only model (manufacturer, kernel, slice thickness) AUC.",
    "Subgroup AUCs by sex, age band and manufacturer.",
    "All results written to docs/EVALUATION_REPORT.md with figures in docs/figures/.",
  ]),
  H2("11.8 Inference Performance"),
  P("Full analysis (validation, lung segmentation, preprocessing, 5-model ensemble, previews) must take ≤ 3 minutes per scan on a laptop CPU (4 cores, 16 GB RAM). No GPU is needed to run the application.")
);

// 12. NFR
children.push(
  H1("12. Non-Functional Requirements"),
  table(
    ["ID", "Category", "Requirement"],
    [
      ["NFR-1", "Performance", "Pages load in < 2 s locally; a 500 MB upload completes in < 2 min on the same machine; analysis ≤ 3 min per scan on CPU."],
      ["NFR-2", "Security", "Argon2id password hashing; JWT auth; server-side role checks on every endpoint; input validation on every request; upload type and size checks; secrets only in .env (never committed); dependency vulnerability scan in CI."],
      ["NFR-3", "Privacy", "De-identification on upload; no patient identifiers or medical content in logs; patient identity stored only in the patients table; deleting a patient deletes all their files."],
      ["NFR-4", "Reliability", "Failed jobs never crash the system; clear error reasons; worker retries once; `make backup` and `make restore` for database and files."],
      ["NFR-5", "Usability", "Upload reachable in ≤ 3 clicks from the dashboard; plain-language results; consistent layout; works in the latest Chrome, Edge and Firefox at ≥ 1280 px width."],
      ["NFR-6", "Portability", "Runs with Docker Compose on Windows 10/11 (Docker Desktop + WSL2), macOS and Ubuntu; no internet needed during the demo once images and the model are downloaded."],
      ["NFR-7", "Maintainability", "Linted and formatted code (ruff, eslint, prettier); ≥ 70% line coverage for backend and ml packages; typed APIs; documented modules."],
      ["NFR-8", "Reproducibility", "Fixed seeds, saved configs, committed splits.json, manifest hash and git commit recorded in the model bundle."],
      ["NFR-9", "Transparency", "Demo-model banner whenever `is_demo` is true; disclaimer on every result and report; model card accessible to admins."],
    ],
    [1, 1.8, 7.2]
  )
);

// 13. Tech stack
children.push(
  H1("13. Technology Stack"),
  table(
    ["Layer", "Choice", "Purpose"],
    [
      ["Frontend", "React 18, TypeScript 5, Vite 5, Tailwind CSS 3, React Router 6, TanStack Query 5", "Web interface"],
      ["Backend", "Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic", "REST API and data access"],
      ["Database", "PostgreSQL 16", "Persistent data"],
      ["Queue", "Redis 7 + RQ", "Background analysis jobs"],
      ["Medical imaging", "pydicom (+ pylibjpeg), SimpleITK, lungmask", "DICOM reading, de-identification, preprocessing, lung segmentation"],
      ["Deep learning", "PyTorch 2.x, MONAI 1.3+", "3D CNN training and inference (CUDA on the GPU computer, CPU in Docker)"],
      ["Statistics", "scikit-learn, SciPy, NumPy, pandas", "Baselines, calibration, metrics, bootstrap, DeLong"],
      ["Reports", "ReportLab", "PDF generation"],
      ["Testing", "pytest, Vitest, Playwright", "Unit, integration and end-to-end tests"],
      ["Tooling", "Docker Compose v2, Make, ruff, eslint, prettier, pre-commit, GitHub Actions", "Build, run, lint, CI"],
      ["Implementation agent", "Claude Code", "Writes all code, tests and technical docs per phase"],
    ],
    [2, 5, 3]
  )
);

// 14. Repo & git
children.push(
  H1("14. Repository Structure and Git Workflow"),
  H2("14.1 Repository Layout (github.com/ahmadraza225/CaviNet_V1)"),
  table(
    ["Path", "Contents"],
    [
      ["backend/", "FastAPI app (api, core, models, services, workers), Alembic migrations, tests"],
      ["frontend/", "React app, components, pages, tests"],
      ["ml/", "`cavinet_ml` Python package: io, preprocessing, model, inference, training, evaluation, CLI; configs/; tests/"],
      ["models/", "Downloaded model bundle (git-ignored)"],
      ["docs/", "scope/ (this document, .docx and .md), PRD traceability, USER_MANUAL, DEVELOPER_GUIDE, TRAINING_RUNBOOK, MODEL_CARD, EVALUATION_REPORT, figures/, audit/"],
      ["scripts/", "Utility scripts (e.g. dataset audit)"],
      ["docker-compose.yml, Makefile, .env.example", "One-command run: `make up`, `make down`, `make test`, `make lint`, `make seed`, `make fetch-model`, `make backup`"],
      [".github/workflows/", "CI: lint, tests and build for backend, ml and frontend"],
    ],
    [3, 7]
  ),
  gap(),
  H2("14.2 Workflow for Every Phase"),
  ...bullets([
    "`main` is the stable branch. Each phase is built on its own branch (`phase-01-foundation`, `phase-02-accounts`, …) or the branch the Claude Code session assigns.",
    "Claude Code commits, pushes and opens a pull request titled \"Phase NN — name\" with the acceptance checklist.",
    "CI must be green. A team reviewer (Section 16) checks each acceptance criterion, then merges (squash) and tags the release (`v0.1`, `v0.2`, …).",
    "If something fails review, the reviewer gives Claude Code a short fix-up prompt listing the failing criteria; the same PR is updated.",
  ]),
  H2("14.3 Definition of Done (applies to every phase)"),
  ...bullets([
    "All acceptance criteria of the phase are met and evidenced in the PR.",
    "Automated tests written and passing in CI; no lint errors.",
    "CHANGELOG.md and affected docs updated; docs/TRACEABILITY.md maps each implemented FR to its test(s).",
    "No secrets, patient data or dataset files committed.",
    "PR reviewed, merged into main and tagged.",
  ])
);

// 15. Phases
children.push(
  H1("15. Implementation Phases"),
  H2("15.0 How to Use This Section"),
  ...bullets([
    "Each phase is one unit of work for Claude Code and ends in one merged pull request.",
    "To start a phase, open a Claude Code session on the repository and paste the phase's prompt block exactly as written.",
    "Phases must be done in order; optional phases 10 and 11 may be skipped.",
    "**Week 1 (Phases 1–7):** the complete system, all code and all documentation, working end-to-end with a demo model. No real-dataset processing.",
    "**After Week 1 (Phases 8–12):** dataset download, training on the GPU computer, real-model integration, optional extras, final release.",
  ]),
  H2("15.1 Phase Overview"),
  table(
    ["Phase", "Name", "When", "Modules", "Output tag"],
    [
      ["1", "Foundation and repository setup", "Week 1, Day 1", "—", "v0.1"],
      ["2", "Accounts, roles and administration", "Week 1, Day 2", "M-01, M-09", "v0.2"],
      ["3", "Patients and doctor dashboard", "Week 1, Day 3", "M-02, M-03", "v0.3"],
      ["4", "CT upload, de-identification and case workflow", "Week 1, Day 4", "M-04, M-08", "v0.4"],
      ["5", "AI inference engine and results", "Week 1, Day 5", "M-05, M-06", "v0.5"],
      ["6", "Training and evaluation toolkit", "Week 1, Day 6", "M-10", "v0.6"],
      ["7", "Reports, end-to-end testing and documentation", "Week 1, Day 7", "M-07", "v0.9-demo"],
      ["8", "Dataset processing and model training (GPU computer)", "Weeks 2–3", "M-10", "model release"],
      ["9", "Real-model integration and final evaluation", "Week 4", "M-05, M-06, M-07", "v1.0"],
      ["10", "Heatmap explanation (optional)", "Week 5", "M-11", "v1.1"],
      ["11", "Symptom-assisted prediction (optional)", "Week 6", "M-12", "v1.2"],
      ["12", "Final release and thesis package", "Weeks 6–7", "all", "v1.x-final"],
    ],
    [0.8, 4.2, 1.8, 1.7, 1.5]
  ),
  gap(),
  NOTE("Week durations after Week 1 are planning estimates; Phase 8 depends on download speed and the GPU's power. The final defense date has not been fixed, and these phases leave ample margin before June 2027.")
);

const phases = [
  {
    n: 1, slug: "foundation", name: "Foundation and repository setup",
    goal: "Create the project skeleton so every later phase plugs into a working, tested, one-command system.",
    deliverables: [
      "Start from the clean CaviNet_V1 repository, which already contains docs/scope/, docs/audit/ and scripts/ (keep them). The earlier Streamlit prototype stays in the old CaviNet repository and is not copied.",
      "Monorepo folders backend/, frontend/, ml/, models/ (git-ignored), docs/ as in Section 14.1.",
      "Backend FastAPI skeleton with `GET /api/health` (checks database and Redis), settings from .env, Alembic initialized.",
      "Frontend React + TypeScript + Vite + Tailwind shell with routing, layout and a placeholder home page.",
      "ml/ package `cavinet_ml` skeleton with pyproject, CLI entry point `cavinet-ml --version`.",
      "docker-compose.yml (postgres, redis, backend, worker, frontend/nginx on http://localhost:8080), .env.example, Makefile targets from Section 14.1.",
      "GitHub Actions CI for lint, tests and build of all three parts; pre-commit config.",
      "New README (what CaviNet is, quick start, dataset attribution, disclaimer), CHANGELOG.md, CONTRIBUTING.md (Section 14 workflow), docs/TRACEABILITY.md template.",
    ],
    accept: [
      "`make up` on a clean machine starts all services; http://localhost:8080 shows the CaviNet shell; `GET /api/health` returns status ok for database and Redis.",
      "`make test` and `make lint` pass locally; CI is green on the PR.",
      "The new README describes the v2.0 project and links to docs/scope/CaviNet_Scope_Document_v2.md.",
    ],
    prompt: [
      "Build the repository foundation described in section 15, Phase 1, and the",
      "layout in section 14.1. Use the exact stack in section 13.",
      "",
      "Tasks:",
      "1. The repository already contains docs/scope/, docs/audit/ and scripts/.",
      "   Keep them unchanged; replace the placeholder README.md in step 7.",
      "2. Create backend/ (FastAPI, Pydantic settings from .env, SQLAlchemy 2,",
      "   Alembic initialised, GET /api/health checking Postgres and Redis).",
      "3. Create frontend/ (React 18 + TypeScript + Vite + Tailwind + React Router +",
      "   TanStack Query) with an app layout and placeholder home page.",
      "4. Create ml/ as the installable package cavinet_ml with a CLI entry point",
      "   'cavinet-ml --version'.",
      "5. docker-compose.yml with postgres:16, redis:7, backend, worker (RQ, same",
      "   image as backend), frontend served by nginx on http://localhost:8080 with",
      "   /api proxied to the backend. Add .env.example and a Makefile with targets:",
      "   up, down, test, lint, seed, fetch-model (stub for now), backup, restore.",
      "6. GitHub Actions CI: ruff + pytest for backend and ml, eslint + vitest +",
      "   build for frontend. Add pre-commit config.",
      "7. New README.md (purpose, quick start, dataset attribution CC BY 4.0,",
      "   disclaimer), CHANGELOG.md, CONTRIBUTING.md (section 14 workflow) and",
      "   docs/TRACEABILITY.md (table: FR ID, implemented in, tests, status).",
      "",
      "Acceptance: see section 15, Phase 1 acceptance criteria.",
    ],
  },
  {
    n: 2, slug: "accounts", name: "Accounts, roles and administration",
    goal: "Secure login, role-based access and the admin area (M-01, M-09).",
    deliverables: [
      "User model and migrations; Argon2id hashing; JWT access/refresh tokens; logout; lockout; forced password change; first admin from env (FR-01.1–01.7).",
      "Role checks on every endpoint (dependency-based), returning 403 when not allowed.",
      "Audit log model, service and middleware; admin endpoints for users and audit log (FR-09.1–09.3).",
      "Frontend: login page, change-password page, protected routes, role-based navigation, inactivity logout, admin Users page and Audit Log page with filters.",
    ],
    accept: [
      "Tests cover: successful/failed login, lockout after 5 failures, token refresh, logout, forced password change, 403 for wrong role on every protected endpoint, audit entries created for each logged action.",
      "Manual check: admin creates a doctor, the doctor logs in, must change the temporary password, and sees no admin menu; admin sees no patient menu.",
      "FR-01.x and FR-09.1–09.3 marked implemented in docs/TRACEABILITY.md with test names.",
    ],
    prompt: [
      "Implement module M-01 (Accounts and Role-Based Access) and FR-09.1 to FR-09.3",
      "of module M-09 (Administration and Audit Log) exactly as specified in",
      "section 10, the role matrix in section 9.3 and NFR-2/NFR-3 in section 12.",
      "",
      "Backend: user model + Alembic migration; Argon2id; 30-min access JWT and",
      "8-hour refresh token in an httpOnly cookie; logout revokes refresh token;",
      "lockout after 5 failed logins for 15 minutes; admin-set temporary passwords",
      "with forced change at next login; first admin created from ADMIN_EMAIL and",
      "ADMIN_PASSWORD env vars; reusable role-check dependency on every endpoint;",
      "audit log table + service recording the events listed in FR-09.2 that exist",
      "so far; admin endpoints to list/create/deactivate/reactivate users, reset",
      "passwords and list/filter audit entries.",
      "",
      "Frontend: login page, change-password page, protected routes, role-based",
      "navigation (Doctor vs Admin), 30-minute inactivity logout, admin Users page",
      "and Audit Log page with filters (user, action, date range).",
      "",
      "Seed command (make seed) creates one demo doctor account.",
      "Acceptance: see section 15, Phase 2 acceptance criteria.",
    ],
  },
  {
    n: 3, slug: "patients-dashboard", name: "Patients and doctor dashboard",
    goal: "Doctors can manage patients and see an overview dashboard (M-02, M-03).",
    deliverables: [
      "Patient model, migrations and CRUD API with search, sorting and pagination (FR-03.1–03.4); delete cascades to future scans/files.",
      "Dashboard statistics and recent-cases endpoint (FR-02.1–02.3); returns zero/empty until Phase 4 adds cases.",
      "Frontend: patient list with search, create/edit form with validation, patient detail page (scan history section), dashboard with stat cards, recent cases table, Upload CT shortcut (disabled until Phase 4) and patient search.",
      "Audit entries for patient create/edit/delete.",
    ],
    accept: [
      "Tests: CRUD, unique MR number, validation errors, pagination/search, doctor-only access (admin gets 403), audit entries.",
      "Manual check: a doctor creates, finds, edits and deletes a patient; the dashboard shows the correct patient count.",
      "Traceability updated for FR-02.x and FR-03.x.",
    ],
    prompt: [
      "Implement modules M-02 (Doctor Dashboard) and M-03 (Patient Management) as",
      "specified in section 10 (FR-02.1 to FR-02.3, FR-03.1 to FR-03.4) and the",
      "role matrix in section 9.3.",
      "",
      "Backend: patient model + migration (fields exactly as FR-03.1, MR number",
      "unique), CRUD endpoints with search by name or MR number, sorting and",
      "pagination (20 per page), permanent delete with confirmation token that will",
      "cascade to scans/files (design the relationship now so Phase 4 can attach",
      "scans), dashboard stats endpoint and recent-cases endpoint (empty until",
      "Phase 4). Doctor role only. Audit log entries for create/edit/delete.",
      "",
      "Frontend: patient list with search and pagination, create/edit form with",
      "client and server validation messages, patient detail page with an empty",
      "'Scans' section, dashboard with the stat cards and recent-cases table from",
      "FR-02, a patient search box and an 'Upload CT' button that is visible but",
      "disabled with the tooltip 'Available in a later phase'.",
      "",
      "Acceptance: see section 15, Phase 3 acceptance criteria.",
    ],
  },
  {
    n: 4, slug: "upload-workflow", name: "CT upload, de-identification and case workflow",
    goal: "Doctors upload DICOM scans that are validated, de-identified, stored and queued; statuses and notifications work (M-04, M-08).",
    deliverables: [
      "Upload endpoint (zip or multiple .dcm, ≤ 1.5 GB, streamed to disk; nginx body limit raised), validation rules, series selection and metadata extraction (FR-04.1–04.6).",
      "De-identification per FR-04.4 before storage; storage layout data/cases/<case-uuid>/.",
      "Case model with status timeline (FR-08.1); RQ job queue; worker with a temporary stub analyser that advances statuses and stores a placeholder result clearly marked STUB.",
      "Notifications model, endpoints and bell UI with 10-second polling (FR-08.2–08.3).",
      "Frontend: upload page with progress bar and clear error messages, case status timeline, patient scan history populated, dashboard counts live.",
      "Synthetic DICOM generator in tests (uncompressed and multi-series cases, including invalid cases).",
    ],
    accept: [
      "Tests: each validation rule rejects bad input with the documented reason; multi-series picks the largest; de-identified files contain none of the removed tags; status transitions; notification created on completion and failure; doctor-only access.",
      "Manual check: upload a generated test scan → statuses progress to Completed (stub) → notification appears → dashboard counts update.",
      "Traceability updated for FR-04.x and FR-08.x.",
    ],
    prompt: [
      "Implement modules M-04 (CT Scan Upload and De-identification) and M-08",
      "(Notifications and Case Workflow) as specified in section 10 (FR-04.1 to",
      "FR-04.6, FR-08.1 to FR-08.3) and NFR-1/NFR-3 in section 12.",
      "",
      "Backend: streaming upload endpoint for one .zip or multiple .dcm files",
      "(max 1.5 GB; raise the nginx limit accordingly); validation exactly per",
      "FR-04.2 with human-readable failure reasons; pick the series with the most",
      "slices (FR-04.3); de-identify per FR-04.4 BEFORE writing files to",
      "data/cases/<case-uuid>/dicom/; store metadata per FR-04.5; case model with",
      "the status timeline in FR-08.1; enqueue an RQ job; worker runs a temporary",
      "stub analyser (clearly named stub, result flagged STUB) that walks through",
      "the statuses so the workflow is testable before Phase 5. Notifications model",
      "and endpoints (list, unread count, mark read, mark all read).",
      "",
      "Frontend: upload page reachable from dashboard and patient page (enable the",
      "Upload CT button), progress bar, error display, case page with status",
      "timeline, bell icon with unread count polling every 10 seconds, patient scan",
      "history populated, dashboard counts live.",
      "",
      "Tests must use a synthetic DICOM generator (valid, invalid and multi-series",
      "cases). Audit log: upload events.",
      "Acceptance: see section 15, Phase 4 acceptance criteria.",
    ],
  },
  {
    n: 5, slug: "inference-results", name: "AI inference engine and results",
    goal: "Replace the stub with the real AI pipeline code and show results to doctors (M-05, M-06), using a demo model until real training is done.",
    deliverables: [
      "`cavinet_ml` modules: DICOM loading (SimpleITK, JPEG-Lossless support), preprocessing exactly per Section 11.1 with lungmask (weights baked into the Docker image at build time), model definition per 11.2, bundle save/load per 11.6, inference with ensemble, temperature scaling and confidence bands per 11.5.",
      "Demo bundle generator: trains a tiny model on synthetic volumes, `is_demo = true`; `make fetch-model` falls back to it when no real model is available.",
      "Worker uses the real pipeline; previews (48 slices + 3 representative) generated (FR-05.3); warnings and timing recorded (FR-05.4); failure handling and one retry (FR-05.5).",
      "Result API and result page: class, probability, confidence, band, explanation text, validated metrics from model card, disclaimer, slice viewer, DEMO banner (FR-06.1–06.4, FR-05.6).",
      "Admin model-information page (FR-09.4).",
    ],
    accept: [
      "Unit tests for every preprocessing step (shapes, spacing, HU clipping, window range, float16 output), bundle round-trip with `weights_only=True`, confidence band boundaries (64.9/65/79.9/80%), and the predicted-class rule.",
      "Integration test: synthetic scan → worker → stored result with demo flag.",
      "Inference time for a 300-slice synthetic scan measured on CPU and recorded in the PR (target ≤ 3 min, NFR-1).",
      "Every result view shows the DEMO banner while `is_demo` is true.",
    ],
    prompt: [
      "Implement module M-05 (AI Analysis Pipeline, inference) and M-06 (Result and",
      "Decision Support), plus FR-09.4, exactly per section 10 and section 11",
      "(11.1 preprocessing, 11.2 model, 11.5 calibration/confidence, 11.6 bundle).",
      "",
      "In ml/cavinet_ml: DICOM series loading with SimpleITK (must decode",
      "JPEG-Lossless), HU conversion and every step of the section 11.1 table, using",
      "the lungmask R231 model with the documented fallback; MONAI 3D ResNet-18 per",
      "11.2; bundle save/load per 11.6 (loadable with torch.load(weights_only=True));",
      "ensemble inference + temperature scaling + predicted class + confidence +",
      "band per 11.5. The SAME code must be used later for training.",
      "",
      "Demo model: a script that trains a tiny model on synthetic volumes and exports",
      "a bundle with is_demo=true. 'make fetch-model' downloads the release asset",
      "named in .env if available, otherwise builds the demo bundle. Bake the",
      "lungmask weights into the worker Docker image at build time (no download",
      "at runtime).",
      "",
      "Replace the Phase 4 stub in the worker; generate previews per FR-05.3; record",
      "warnings/timing per FR-05.4; failure handling per FR-05.5. Result endpoint and",
      "result page per FR-06.1 to FR-06.4 with the exact disclaimer text; DEMO",
      "banner per FR-05.6 everywhere results appear; admin model info page.",
      "",
      "Measure and report CPU inference time for a 300-slice synthetic scan.",
      "Acceptance: see section 15, Phase 5 acceptance criteria.",
    ],
  },
  {
    n: 6, slug: "training-toolkit", name: "Training and evaluation toolkit",
    goal: "Everything needed to train and evaluate the real model, fully tested on a synthetic mini-dataset, plus a step-by-step runbook for the GPU computer (M-10).",
    deliverables: [
      "CLI commands per FR-10.1–10.8: index, preprocess (from zip, patient by patient, resumable, parallel, QC report), split, train, calibrate, export, evaluate, baseline, shortcut-check, compare.",
      "YAML training config with every value from Section 11.4; TensorBoard/CSV logging; checkpoints and resume; automatic batch-size reduction when GPU memory is short.",
      "Evaluation per Section 11.7 producing docs/EVALUATION_REPORT.md and figures; test-split guard (FR-10.7).",
      "PatientIndex.xlsx parser handling legend rows, blank = absent symptoms, Case_/TB_ naming.",
      "CI end-to-end test: synthetic mini-dataset (e.g. 24 cases, zipped like Kaggle) → index → preprocess → split → train 2 folds × 1 epoch → calibrate → export → evaluate.",
      "docs/TRAINING_RUNBOOK.md: GPU computer setup (Ubuntu 22.04 or Windows 11 + WSL2, NVIDIA driver, CUDA PyTorch), Kaggle API token, download command, disk space, every command in order, expected run times, troubleshooting, and how to publish the model as a GitHub Release.",
    ],
    accept: [
      "The synthetic end-to-end pipeline passes in CI.",
      "The exported bundle from the synthetic run loads in the app (Phase 5 code) and produces a result.",
      "Running evaluate on the test split twice without --force is refused.",
      "The runbook is complete enough that a team member can follow it without asking questions (reviewed by Mahnoor and Ahmed).",
    ],
    prompt: [
      "Implement module M-10 (Model Training and Evaluation Toolkit) exactly per",
      "section 10 (FR-10.1 to FR-10.8), section 7.3 and sections 11.1 to 11.7.",
      "Reuse the Phase 5 preprocessing/model/bundle code; do not duplicate it.",
      "",
      "Commands (cavinet-ml ...): index (Kaggle zip or folder + PatientIndex.xlsx",
      "-> manifest.csv; ignore legend rows; blank symptom = absent; folders",
      "TB/TB_xxx and NTM/Case_xxx), preprocess (reads the zip patient by patient",
      "without full extraction, parallel workers, resumable, float16 cache + QC",
      "CSV with failures and warnings), split (locked 20% test + 5 folds, strata",
      "per 11.3, seed 42, splits.json), train --fold k (config YAML with all 11.4",
      "values, AMP, gradient accumulation, early stopping, checkpoints, resume,",
      "TensorBoard + CSV logs, auto batch-size reduction on CUDA OOM), calibrate,",
      "export (bundle + model_card.json + docs/MODEL_CARD.md), evaluate (all 11.7",
      "metrics and figures -> docs/EVALUATION_REPORT.md; refuse a second test-split",
      "run without --force and log every run), baseline, shortcut-check, compare",
      "(DeLong).",
      "",
      "Add a synthetic mini-dataset generator that mimics the Kaggle layout",
      "(zip, JPEG-free DICOM, PatientIndex.xlsx with legend rows) and a CI test that",
      "runs the whole chain with 2 folds x 1 epoch on CPU.",
      "",
      "Write docs/TRAINING_RUNBOOK.md for the team's GPU computer per section 17,",
      "including environment setup, Kaggle token, download, every command in",
      "order, expected durations, troubleshooting and publishing the bundle as a",
      "GitHub Release asset.",
      "Acceptance: see section 15, Phase 6 acceptance criteria.",
    ],
  },
  {
    n: 7, slug: "reports-e2e-docs", name: "Reports, end-to-end testing and documentation",
    goal: "Complete the core system: PDF reports, hardening, end-to-end tests and all user/developer documentation; release v0.9-demo.",
    deliverables: [
      "PDF report per FR-07.1–07.3 (ReportLab), download button on the result page.",
      "Playwright end-to-end test: admin creates doctor → doctor logs in → creates patient → uploads synthetic scan → sees result → downloads PDF → notification read.",
      "Security pass: authorization tests for every endpoint, upload limit tests, security headers, dependency scan in CI.",
      "`make backup` / `make restore`; error pages; empty states; loading states.",
      "docs/USER_MANUAL.md (with Playwright screenshots), docs/DEVELOPER_GUIDE.md, docs/DEPLOYMENT.md (team laptop), completed docs/TRACEABILITY.md (every core FR → test).",
      "Release notes and tag v0.9-demo.",
    ],
    accept: [
      "The end-to-end test passes in CI; the PDF contains every FR-07.2 item.",
      "On a clean team laptop, following docs/DEPLOYMENT.md, `make up` runs the full demo in under 15 minutes of setup.",
      "Every core FR (M-01 to M-09, M-10 tooling) is traced to at least one passing test.",
    ],
    prompt: [
      "Complete the core system: implement M-07 (Diagnostic PDF Report, FR-07.1 to",
      "FR-07.3) with ReportLab, then harden and document everything per sections",
      "10, 12 and 14.3.",
      "",
      "1. PDF report with every item in FR-07.2, download button, audit entry.",
      "2. Playwright end-to-end test of the full journey in section 9.2 (admin",
      "   creates doctor -> doctor changes password -> creates patient -> uploads a",
      "   synthetic scan -> result -> PDF -> notification read), run in CI.",
      "3. Authorization tests for every endpoint and role, upload limit tests,",
      "   security headers, dependency vulnerability scan in CI.",
      "4. make backup / make restore; friendly error, empty and loading states.",
      "5. docs/USER_MANUAL.md for doctors and admins in plain language with",
      "   screenshots captured by Playwright; docs/DEVELOPER_GUIDE.md;",
      "   docs/DEPLOYMENT.md for a Windows/macOS/Linux team laptop; complete",
      "   docs/TRACEABILITY.md so every core FR maps to passing tests.",
      "6. Release notes in CHANGELOG.md; after merge the reviewer tags v0.9-demo.",
      "",
      "Acceptance: see section 15, Phase 7 acceptance criteria.",
    ],
  },
  {
    n: 8, slug: "training", name: "Dataset processing and model training (GPU computer)",
    goal: "Download the real dataset, preprocess all 1,301 scans, train and calibrate the 5-fold ensemble, evaluate once on the locked test set, and publish the model bundle.",
    where: "Run on the team's GPU computer. Recommended: install Claude Code on the GPU computer and give it this prompt, so Claude Code runs and monitors every command itself. Alternative: the GPU operator runs the commands from docs/TRAINING_RUNBOOK.md and pastes outputs back to Claude Code.",
    deliverables: [
      "Environment set up per the runbook; Kaggle dataset `damianhan/dicom-dataset` downloaded and checksum recorded.",
      "manifest.csv (1,301 rows) and dataset statistics in docs/audit/DATASET_AUDIT.md (counts, demographics, scanners, slice thickness, failures).",
      "Preprocessed cache; QC report; splits.json committed.",
      "5 folds trained; training curves; out-of-fold metrics; calibration.",
      "Clinical baseline, shortcut check and DeLong comparison.",
      "Locked test evaluation run exactly once → docs/EVALUATION_REPORT.md + figures.",
      "Model bundle published as GitHub Release asset `cavinet_model.pth` (tag model-v1); docs/MODEL_CARD.md.",
    ],
    accept: [
      "≥ 98% of scans preprocessed; every failure listed with its reason.",
      "All metrics in Section 11.7 reported with 95% CIs; H1 and H2 explicitly stated as supported or not supported.",
      "The test split evaluation log shows a single run.",
      "The release asset downloads with `make fetch-model` and loads with `weights_only=True`.",
      "No dataset files, cached volumes or personal data committed.",
    ],
    prompt: [
      "Execute Phase 8 on this GPU computer, following docs/TRAINING_RUNBOOK.md and",
      "sections 7, 11 and 17. You run every command yourself and monitor it.",
      "",
      "1. Verify the environment (nvidia-smi, CUDA PyTorch, disk >= 150 GB free,",
      "   Kaggle token present). Stop and tell me exactly what is missing if not.",
      "2. Download damianhan/dicom-dataset with the Kaggle CLI (resume if it",
      "   breaks); record the file checksum.",
      "3. cavinet-ml index -> manifest.csv; write docs/audit/DATASET_AUDIT.md with",
      "   counts, demographics, scanner/kernel/thickness distributions and problems.",
      "4. cavinet-ml preprocess (all cases) -> QC report; investigate failures; the",
      "   target is >= 98% success. Do not change section 11.1 parameters without",
      "   asking me.",
      "5. cavinet-ml split -> commit splits.json.",
      "6. Train folds 0-4 (resume after interruptions), then calibrate and export.",
      "7. Run baseline, shortcut-check and compare on the development folds.",
      "8. Only after the model is frozen: cavinet-ml evaluate --split test, ONCE.",
      "9. Write docs/EVALUATION_REPORT.md and docs/MODEL_CARD.md; state clearly",
      "   whether H1 and H2 (section 4.3) are supported, including if not.",
      "10. Publish cavinet_model.pth as a GitHub Release asset (tag model-v1) and",
      "    set the release URL in .env.example for make fetch-model.",
      "",
      "Commit only code fixes, configs, splits.json, reports, figures and logs",
      "summaries; never dataset files, caches or checkpoints.",
      "Acceptance: see section 15, Phase 8 acceptance criteria.",
    ],
  },
  {
    n: 9, slug: "model-integration", name: "Real-model integration and final evaluation",
    goal: "Put the trained model into the application, verify it on real scans, and release v1.0.",
    deliverables: [
      "App uses the real bundle by default (`make fetch-model`); DEMO banner disappears automatically when `is_demo` is false.",
      "Result page, PDF and admin model page show the real validated metrics from the model card.",
      "Verification: 10 real test-set scans (5 TB, 5 NTM, de-identified, from the GPU computer) uploaded through the UI; app predictions match the toolkit's predictions for the same cases.",
      "CPU inference time on a real 300-slice scan measured on the team laptop (≤ 3 min).",
      "Thesis-ready figures and tables exported to docs/figures/ and docs/tables/.",
      "Tag v1.0.",
    ],
    accept: [
      "App and toolkit probabilities agree to within 0.01 for the 10 verification scans.",
      "Inference ≤ 3 minutes on the team laptop, or a documented, agreed exception.",
      "Full end-to-end test passes with the real model.",
    ],
    prompt: [
      "Integrate the real model bundle (release model-v1) into the application and",
      "verify it, per sections 11 and 15 (Phase 9).",
      "",
      "1. make fetch-model downloads the real bundle by default; demo bundle only as",
      "   fallback. DEMO banner must disappear when is_demo is false.",
      "2. Result page, PDF and admin model page show the validated test metrics from",
      "   the model card.",
      "3. Verification: I will provide 10 de-identified real test-set scans (5 TB,",
      "   5 NTM). Write a script that uploads them through the API, collects the",
      "   app's probabilities and compares them with the toolkit's predictions for",
      "   the same cases (must agree within 0.01). Save the comparison table.",
      "4. Measure CPU inference time for a real 300-slice scan on this laptop.",
      "5. Export thesis-ready figures/tables (ROC, calibration, confusion matrix,",
      "   training curves, subgroup table, baseline comparison) to docs/figures/",
      "   and docs/tables/.",
      "6. Update USER_MANUAL screenshots and CHANGELOG; reviewer tags v1.0.",
      "Acceptance: see section 15, Phase 9 acceptance criteria.",
    ],
  },
  {
    n: 10, slug: "heatmap", name: "Heatmap explanation (optional)",
    goal: "Show which lung regions most influenced each prediction (M-11) and test hypothesis H4.",
    deliverables: [
      "Grad-CAM per FR-11.1 in `cavinet_ml`, computed in the worker after prediction.",
      "Viewer overlay toggle, top-3 slices highlighted, PDF section, wording per FR-11.3.",
      "Evaluation of heatmap share inside the lung mask on the test set (FR-11.4) added to the evaluation report.",
    ],
    accept: [
      "Heatmap shown for every completed case with the required wording.",
      "H4 result reported (supported or not).",
      "Analysis time still ≤ 3 minutes on CPU, or the increase is documented and agreed.",
    ],
    prompt: [
      "Implement optional module M-11 (Heatmap Explanation) per FR-11.1 to",
      "FR-11.4 in section 10 and hypothesis H4 in section 4.3.",
      "",
      "Grad-CAM on the last convolutional block of each fold model, averaged and",
      "mapped back to the 48 preview slices; viewer overlay toggle; highlight the 3",
      "slices with the highest heatmap share; add them to the PDF; use the exact",
      "wording in FR-11.3. Add a toolkit command that computes the share of heatmap",
      "energy inside the lung mask over the locked test set and appends the result",
      "(H4 supported or not) to docs/EVALUATION_REPORT.md. Measure CPU time impact.",
      "Acceptance: see section 15, Phase 10 acceptance criteria.",
    ],
  },
  {
    n: 11, slug: "symptom-fusion", name: "Symptom-assisted prediction (optional)",
    goal: "Combine the CT result with age, sex and symptoms (M-12) and test hypothesis H3.",
    deliverables: [
      "Upload form section with the 12 dataset symptoms (optional checkboxes); age and sex from the patient record.",
      "Fusion logistic regression trained on out-of-fold CT logits + clinical features; evaluated once on the locked test set; DeLong vs CT-only.",
      "Fusion parameters stored in a versioned file next to the model bundle; result page and PDF show CT-only and combined results.",
    ],
    accept: [
      "Combined result shown only when symptoms were entered; CT-only always shown.",
      "H3 result reported in the evaluation report (supported or not).",
      "Tests cover fusion maths, missing-symptom handling and UI states.",
    ],
    prompt: [
      "Implement optional module M-12 (Symptom-Assisted Prediction) per FR-12.1 to",
      "FR-12.3 in section 10 and hypothesis H3 in section 4.3.",
      "",
      "Upload form: optional checkboxes for the 12 dataset symptoms (section 7.1);",
      "age from date of birth and sex from the patient record. Toolkit: train a",
      "logistic-regression fusion model on the out-of-fold CT logits plus age, sex",
      "and symptoms (same splits), evaluate once on the locked test set, compare",
      "with CT-only using DeLong, save versioned fusion parameters next to the model",
      "bundle and append results to docs/EVALUATION_REPORT.md. App: show CT-only",
      "always and the combined result when symptoms were entered, on the result",
      "page and in the PDF.",
      "Acceptance: see section 15, Phase 11 acceptance criteria.",
    ],
  },
  {
    n: 12, slug: "final-release", name: "Final release and thesis package",
    goal: "Freeze a polished, fully documented final version and hand the team everything needed for the thesis and viva.",
    deliverables: [
      "Final README, CHANGELOG and release notes; all docs consistent with the delivered system.",
      "Thesis support pack in docs/thesis/: system architecture diagram, module diagram, database schema diagram, sequence diagram of an analysis, all evaluation figures/tables, hypothesis results summary (H1–H5), limitations, and a methods description of the AI pipeline.",
      "Demo script for the viva (step-by-step, with sample de-identified scans and expected outputs) and a fallback recorded screen capture plan.",
      "Final tag v1.x-final and GitHub Release with the model asset.",
    ],
    accept: [
      "A fresh clone on a team laptop reaches a working demo by following README only.",
      "Every hypothesis has a stated outcome with evidence links.",
      "Supervisor sign-off on the final demo.",
    ],
    prompt: [
      "Prepare the final release and thesis package per section 15, Phase 12.",
      "",
      "1. Make README, all docs and CHANGELOG consistent with the delivered system;",
      "   remove anything outdated.",
      "2. Create docs/thesis/ with: architecture diagram, module diagram, database",
      "   schema diagram, sequence diagram of one analysis (Mermaid sources + PNG",
      "   exports), all evaluation figures and tables, a hypothesis summary table",
      "   (H1-H5: supported / not supported / not attempted, with evidence links),",
      "   limitations, and a methods write-up of the AI pipeline for the thesis.",
      "3. docs/VIVA_DEMO_SCRIPT.md: exact demo steps, sample scans, expected results,",
      "   and what to do if something fails.",
      "4. Verify a fresh clone works by following README only; fix any gaps.",
      "5. Release notes; reviewer tags v1.x-final and publishes the GitHub Release.",
      "Acceptance: see section 15, Phase 12 acceptance criteria.",
    ],
  },
];

for (const ph of phases) {
  const num = String(ph.n).padStart(2, "0");
  children.push(H2(`15.${ph.n + 1} Phase ${ph.n}: ${ph.name}`));
  children.push(P(`**Goal:** ${ph.goal}`));
  if (ph.where) children.push(NOTE(`**Where this runs:** ${ph.where}`));
  children.push(H3("Deliverables"), ...bullets(ph.deliverables));
  children.push(H3("Acceptance criteria"), ...bullets(ph.accept));
  children.push(...promptBlock(`Phase ${num}`, [...PROMPT_HEADER(ph.n, ph.name), ...ph.prompt, ...PROMPT_FOOTER(ph.n, ph.slug)]));
}

// 16. Team
children.push(
  H1("16. Team Roles and Responsibilities"),
  P("Claude Code implements the technical work. The team directs, verifies, operates training and writes the thesis. Every merged phase is reviewed by a named person."),
  table(
    ["Person", "Role", "Responsibilities"],
    [
      ["Ahmed Raza (230958)", "Project lead and GPU operator", "Owns the GitHub repository and merges PRs; issues phase prompts; operates the GPU computer for Phase 8 (if another member owns the GPU computer, that member takes this duty); reviews Phases 1, 4, 8, 9."],
      ["Khudema Haroon (232942)", "AI validation lead", "Reviews Phases 5, 6, 8, 10, 11: checks the AI specification is followed, verifies metrics and figures, owns the Methods and Results thesis chapters."],
      ["Mahnoor Iqbal (230910)", "QA and documentation lead", "Tests every phase against its acceptance criteria before merge; reviews Phases 2, 3, 7, 12; owns the user manual review, Introduction/Literature Review chapters and the viva demo script."],
      ["Claude Code", "Implementation agent", "Writes all code, tests, CI, technical documentation and reports for each phase; opens PRs with evidence; runs training on the GPU computer when installed there."],
      ["Sohaib Masood", "Supervisor", "Approves scope v2.0, milestone reviews, final sign-off."],
      ["Kanwal Ejaz", "Co-Supervisor", "Technical advice; reviews evaluation methodology and results (Phases 8–9)."],
    ],
    [2.4, 2.2, 5.4]
  )
);

// 17. Hardware
children.push(
  H1("17. Hardware, Software and Accounts Required"),
  table(
    ["Item", "Minimum", "Recommended"],
    [
      ["GPU computer: GPU", "NVIDIA GPU with 8 GB memory (e.g. RTX 3060 8 GB / RTX 2070)", "12 GB or more (e.g. RTX 3060 12 GB, RTX 4070)"],
      ["GPU computer: system", "16 GB RAM, 6-core CPU, Ubuntu 22.04 or Windows 11 + WSL2", "32 GB RAM, 8+ cores"],
      ["GPU computer: disk", "150 GB free SSD (about 92 GB download + about 10 GB cache + working space)", "250 GB free SSD"],
      ["GPU computer: internet", "Stable connection for a ~92 GB one-time download", "Wired connection"],
      ["Team laptop (demo)", "16 GB RAM, 4-core CPU, 20 GB free disk, Docker Desktop", "Same"],
      ["Accounts", "GitHub (repository access), Kaggle account with API token (free)", "—"],
      ["Software", "Docker Desktop; NVIDIA driver + CUDA-enabled PyTorch on the GPU computer; Claude Code", "Claude Code also installed on the GPU computer"],
    ],
    [2.3, 4.2, 3.5]
  ),
  gap(),
  NOTE("If the GPU has less than 8 GB memory, the toolkit reduces batch size automatically; if it is still too small, the input size can be reduced to 96 × 96 × 96 (a documented change requiring re-approval of Section 11). Estimated times on an RTX 3060 (planning figures only): preprocessing 4–8 hours, training 1–2 hours per fold (5–10 hours in total).")
);

// 18. Risks
children.push(
  H1("18. Risks and Mitigations"),
  table(
    ["Risk", "Likelihood", "Impact", "Mitigation"],
    [
      ["Model accuracy below target (AUC < 0.75)", "Medium", "Medium", "Honest reporting is built in; thesis remains valid as an evaluation study; optional symptom fusion may improve results; clinical baseline gives context."],
      ["Model learns shortcuts (age, sex, scanner)", "Medium", "High", "Stratified splits, shortcut check, subgroup analysis, lung-cropped input; findings reported."],
      ["One-week timeline for Phases 1–7 slips", "Medium", "Medium", "Phases are small and independent; Phase 7 is the buffer; optional items never block core."],
      ["GPU too weak or unavailable", "Low–Medium", "High", "Automatic batch reduction; 96³ fallback; Kaggle free GPU as last resort (runbook covers it)."],
      ["Large download fails or disk fills", "Medium", "Medium", "Resumable download; zip processed patient by patient; disk check before starting."],
      ["Unusual DICOM files break preprocessing", "Medium", "Low", "Validation with clear errors; QC report; ≥ 98% success target; failures listed."],
      ["Slow CPU inference on the laptop", "Low", "Medium", "128³ input, ResNet-18, timing measured in Phases 5 and 9; option to use fewer ensemble members (documented)."],
      ["Claude Code produces a defect", "Medium", "Medium", "Tests and CI on every phase; human acceptance review; fix-up prompts."],
    ],
    [3, 1.3, 1.2, 4.5]
  )
);

// 19. Limitations
children.push(
  H1("19. Limitations"),
  ...bullets([
    "Single-centre data (one hospital in China): performance may differ elsewhere; no external validation set is available without data requests.",
    "Only patients with TB or NTM: the system must not be used on patients without suspected mycobacterial disease.",
    "No lesion-level ground truth: the system does not detect cavities or other lesions; the optional heatmap is an explanation, not a lesion marker.",
    "Labels come from the dataset's diagnoses; any errors in them are inherited.",
    "TB and NTM overlap substantially on CT; perfect separation is not expected.",
    "Research prototype only: not a medical device and not clinically validated.",
  ])
);

// 20. Ethics
children.push(
  H1("20. Ethics and Data Governance"),
  ...bullets([
    "The training data is public, anonymised and licensed CC BY 4.0; it is cited in the thesis, README and model card.",
    "No real patient data from Pakistani hospitals is collected in this project; any future use with real patients would require institutional ethics approval.",
    "Uploaded scans are de-identified on arrival; patient identity is stored separately and deleted with the patient.",
    "The app shows a permanent disclaimer: decision support only, not a diagnosis, confirm with laboratory tests.",
    "All results, including unfavourable ones, are reported honestly.",
  ])
);

// 21. Glossary
children.push(
  H1("21. Glossary (plain language)"),
  table(
    ["Term", "Meaning"],
    [
      ["TB", "Tuberculosis, an infectious lung disease caused by Mycobacterium tuberculosis."],
      ["NTM", "Non-tuberculous mycobacteria: related bacteria causing a TB-like lung disease that needs different treatment."],
      ["CT scan / slice", "A 3D X-ray scan of the chest made of hundreds of thin cross-sectional images (slices)."],
      ["DICOM", "The standard file format for medical images from scanners."],
      ["Hounsfield units (HU)", "The density scale of CT images (air ≈ −1000, water = 0)."],
      ["3D CNN", "A type of neural network that learns patterns directly from 3D images."],
      [".pth file", "The saved trained model (its learned weights and settings)."],
      ["Ensemble", "Several models whose answers are averaged for a more stable result."],
      ["AUC", "A 0–1 score of how well the model separates TB from NTM (0.5 = guessing, 1.0 = perfect)."],
      ["Sensitivity / specificity", "Share of TB cases correctly called TB / share of NTM cases correctly called NTM."],
      ["Calibration", "Whether a stated confidence (e.g. 80%) matches how often the model is actually right."],
      ["Cross-validation", "Training five times on different 80/20 portions of the development data to measure reliability."],
      ["Locked test set", "Patients set aside at the start and used only once at the end for an honest final score."],
      ["Shortcut learning", "When a model uses irrelevant clues (e.g. scanner type) instead of the disease itself."],
      ["Grad-CAM heatmap", "A colour overlay showing which image regions most influenced the model's decision."],
      ["Docker", "Software that packages the whole system so it runs the same on any computer."],
      ["Pull request (PR) / CI", "A proposed code change on GitHub / automatic tests that run on every change."],
    ],
    [2.5, 7.5]
  )
);

// 22. References
children.push(
  H1("22. References"),
  ...[
    "Han, D. et al. (2025). An Integrated Mycobacterial CT Imaging Dataset with Multispecies Information. Scientific Data. Kaggle: damianhan/dicom-dataset (CC BY 4.0).",
    "Kanagala, A. et al. (2026). Whole-Lung CT Radiomics-Based Machine Learning Classification of Nontuberculous Mycobacterial Lung Disease Across Geographically Distinct Cohorts. medRxiv.",
    "Distinguishing nontuberculous mycobacterial lung disease from pulmonary tuberculosis using radiomics machine learning models from CT images (2026). Frontiers in Medicine.",
    "Hofmanninger, J. et al. (2020). Automatic lung segmentation in routine imaging is primarily a data diversity problem, not a methodology problem. European Radiology Experimental, 4, 50.",
    "Chen, S., Ma, K., Zheng, Y. (2019). Med3D: Transfer Learning for 3D Medical Image Analysis. arXiv:1904.00625.",
    "Cardoso, M. J. et al. (2022). MONAI: An open-source framework for deep learning in healthcare. arXiv:2211.02701.",
    "He, K. et al. (2016). Deep Residual Learning for Image Recognition. CVPR.",
    "Guo, C. et al. (2017). On Calibration of Modern Neural Networks. ICML.",
    "DeLong, E. R., DeLong, D. M., Clarke-Pearson, D. L. (1988). Comparing the areas under two or more correlated ROC curves. Biometrics, 44(3), 837–845.",
    "Selvaraju, R. R. et al. (2017). Grad-CAM: Visual Explanations from Deep Networks via Gradient-based Localization. ICCV.",
    "World Health Organization (2024). Global Tuberculosis Report 2024.",
    "Haq, I. et al. (2022). Machine Vision Approach for Diagnosing Tuberculosis Based on CT Scan Images. Symmetry, 14(10), 1997.",
  ].map((r) => B(r))
);

// ---------- document ----------
const doc = new Document({
  features: { updateFields: true },
  creator: "CaviNet team",
  title: "CaviNet Project Scope Document v2.0",
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22 } },
      heading1: { run: { size: 32, bold: true, color: ACCENT, font: "Calibri" }, paragraph: { spacing: { before: 240, after: 160 } } },
      heading2: { run: { size: 26, bold: true, color: "2E75B6", font: "Calibri" }, paragraph: { spacing: { before: 240, after: 120 } } },
      heading3: { run: { size: 23, bold: true, color: "404040", font: "Calibri" }, paragraph: { spacing: { before: 160, after: 80 } } },
    },
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 270 } } } },
      ] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: "CaviNet | Air University Islamabad | FYP 2025–2027 | Scope v2.0 | Page ", size: 18, color: "7F7F7F" }),
        new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "7F7F7F" }),
      ] })] }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log("wrote", OUT); });
