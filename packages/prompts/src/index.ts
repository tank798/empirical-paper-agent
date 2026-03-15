export const promptManifest = {
  system: { file: "common/system.md", version: "1.0.0" },
  skills: {
    topic_detect: { file: "skills/topic-detect/template.md", version: "1.0.0" },
    topic_normalize: { file: "skills/topic-normalize/template.md", version: "1.0.0" },
    sop_guide: { file: "skills/sop-guide/template.md", version: "1.0.0" },
    data_cleaning: { file: "skills/data-cleaning/template.md", version: "1.0.0" },
    data_check: { file: "skills/data-check/template.md", version: "1.0.0" },
    baseline_regression: { file: "skills/baseline-regression/template.md", version: "1.0.0" },
    robustness: { file: "skills/robustness/template.md", version: "1.0.0" },
    mechanism: { file: "skills/mechanism/template.md", version: "1.0.0" },
    heterogeneity: { file: "skills/heterogeneity/template.md", version: "1.0.0" },
    iv: { file: "skills/iv/template.md", version: "1.0.0" },
    result_interpret: { file: "skills/result-interpret/template.md", version: "1.0.0" },
    stata_error_debug: { file: "skills/stata-error-debug/template.md", version: "1.0.0" },
    export_table: { file: "skills/export-table/template.md", version: "1.0.0" }
  }
} as const;

export type PromptSkillName = keyof typeof promptManifest.skills;
