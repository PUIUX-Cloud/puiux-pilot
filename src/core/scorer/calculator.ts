/**
 * Quality Score Calculator
 * 6-dimension scoring system: Security, Code Quality, Architecture, Testing, Design, Workflow
 * Ported from health-score.sh logic
 */

import type { ProjectDNA, QualityBaseline, QualityIssue } from "../../shared/types.js";
import { fileExists } from "../../shared/fs-utils.js";
import { join } from "node:path";

const WEIGHTS = {
  security: 25,
  codeQuality: 20,
  architecture: 15,
  testing: 15,
  design: 10,
  workflow: 15,
};

/**
 * Calculate quality score for a project
 */
export async function calculateScore(dna: ProjectDNA): Promise<QualityBaseline> {
  const issues: QualityIssue[] = [];
  const root = dna.identity.root;

  // ─── Security (25%) ────────────────────────────────────────────────────────
  let security = 100;

  // .env not in .gitignore
  if (await fileExists(join(root, ".env"))) {
    const gitignore = await safeReadFile(join(root, ".gitignore"));
    if (!gitignore.includes(".env")) {
      security -= 20;
      issues.push({
        dimension: "security",
        severity: "error",
        message: ".env file exists but is not in .gitignore",
        deduction: 20,
        fixable: true,
      });
    }
  }

  // No .gitignore at all
  if (!(await fileExists(join(root, ".gitignore")))) {
    security -= 10;
    issues.push({
      dimension: "security",
      severity: "warning",
      message: "No .gitignore file found",
      deduction: 10,
      fixable: true,
    });
  }

  // ─── Code Quality (20%) ────────────────────────────────────────────────────
  let codeQuality = 100;

  // No linter
  if (!dna.dependencies.linter) {
    codeQuality -= 15;
    issues.push({
      dimension: "codeQuality",
      severity: "warning",
      message: "No linter detected — consider adding ESLint or Biome",
      deduction: 15,
      fixable: true,
    });
  }

  // ─── Architecture (15%) ────────────────────────────────────────────────────
  let architecture = 100;

  // No .arch-rules.json
  if (!(await fileExists(join(root, ".arch-rules.json")))) {
    architecture -= 5;
    issues.push({
      dimension: "architecture",
      severity: "info",
      message: "No .arch-rules.json — consider defining architecture boundaries",
      deduction: 5,
      fixable: true,
    });
  }

  // ─── Testing (15%) ─────────────────────────────────────────────────────────
  let testing = 100;

  if (!dna.dependencies.testFramework) {
    testing -= 30;
    issues.push({
      dimension: "testing",
      severity: "error",
      message: "No test framework detected",
      deduction: 30,
      fixable: true,
    });
  }

  if (!dna.structure.hasTests) {
    testing -= 25;
    issues.push({
      dimension: "testing",
      severity: "error",
      message: "No test files found",
      deduction: 25,
      fixable: true,
    });
  }

  if (!dna.structure.hasCI) {
    testing -= 15;
    issues.push({
      dimension: "testing",
      severity: "warning",
      message: "No CI/CD pipeline detected",
      deduction: 15,
      fixable: true,
    });
  }

  // ─── Design (10%) ──────────────────────────────────────────────────────────
  let design = 100;

  if (!dna.structure.hasUI) {
    // No UI = design dimension is N/A, score it as 100
    design = 100;
  } else {
    if (!dna.dependencies.cssFramework) {
      design -= 10;
      issues.push({
        dimension: "design",
        severity: "info",
        message: "No CSS framework detected — consider Tailwind CSS",
        deduction: 10,
        fixable: true,
      });
    }
  }

  // ─── Workflow (15%) ─────────────────────────────────────────────────────────
  let workflow = 100;

  if (!(await fileExists(join(root, ".perf-budget.json")))) {
    workflow -= 5;
    issues.push({
      dimension: "workflow",
      severity: "info",
      message: "No .perf-budget.json — consider setting performance budgets",
      deduction: 5,
      fixable: true,
    });
  }

  if (!dna.structure.hasDocs) {
    workflow -= 5;
    issues.push({
      dimension: "workflow",
      severity: "info",
      message: "No documentation directory found",
      deduction: 5,
      fixable: true,
    });
  }

  // ─── Calculate Overall ─────────────────────────────────────────────────────
  const dimensions = {
    security: clamp(security),
    codeQuality: clamp(codeQuality),
    architecture: clamp(architecture),
    testing: clamp(testing),
    design: clamp(design),
    workflow: clamp(workflow),
  };

  const overall = Math.round(
    (dimensions.security * WEIGHTS.security +
      dimensions.codeQuality * WEIGHTS.codeQuality +
      dimensions.architecture * WEIGHTS.architecture +
      dimensions.testing * WEIGHTS.testing +
      dimensions.design * WEIGHTS.design +
      dimensions.workflow * WEIGHTS.workflow) /
      100
  );

  return {
    overall: clamp(overall),
    grade: scoreToGrade(overall),
    dimensions,
    issues,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Format score report for terminal output
 */
export function formatScoreReport(score: QualityBaseline): string {
  const bar = (value: number) => {
    const filled = Math.round(value / 5);
    return "█".repeat(filled) + "░".repeat(20 - filled);
  };

  const lines: string[] = [
    "",
    `  Quality Score: ${score.overall}/100  ${bar(score.overall)}  ${score.grade}`,
    "",
    `  Security      [${pad(score.dimensions.security)}] ${bar(score.dimensions.security)}`,
    `  Code Quality  [${pad(score.dimensions.codeQuality)}] ${bar(score.dimensions.codeQuality)}`,
    `  Architecture  [${pad(score.dimensions.architecture)}] ${bar(score.dimensions.architecture)}`,
    `  Testing       [${pad(score.dimensions.testing)}] ${bar(score.dimensions.testing)}`,
    `  Design        [${pad(score.dimensions.design)}] ${bar(score.dimensions.design)}`,
    `  Workflow      [${pad(score.dimensions.workflow)}] ${bar(score.dimensions.workflow)}`,
  ];

  // Top recommendations
  const topIssues = score.issues
    .sort((a, b) => b.deduction - a.deduction)
    .slice(0, 3);

  if (topIssues.length > 0) {
    lines.push("");
    lines.push("  Top Actions:");
    for (const issue of topIssues) {
      lines.push(`    [+${issue.deduction} pts] ${issue.message}`);
    }
  }

  return lines.join("\n");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function scoreToGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function pad(n: number): string {
  return String(n).padStart(3);
}

async function safeReadFile(path: string): Promise<string> {
  try {
    const { readFile } = await import("node:fs/promises");
    return await readFile(path, "utf-8");
  } catch {
    return "";
  }
}
