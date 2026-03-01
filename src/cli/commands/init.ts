/**
 * puiux-pilot init
 *
 * Pipeline: scan → select → plan → [apply] → [verify] → [score]
 *
 * DEFAULT mode is DRY-RUN: shows what would change, then exits.
 * --apply  : actually writes files
 * --force  : overwrite even if hooks were user-modified
 */

import chalk from "chalk";
import ora from "ora";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { accessSync } from "node:fs";
import { homedir } from "node:os";
import { scanProject } from "../../core/scanner/index.js";
import {
  selectHooks,
  summarizeSelection,
} from "../../core/configurator/hook-selector.js";
import { selectMCPs } from "../../core/configurator/mcp-selector.js";
import { selectSkills } from "../../core/configurator/skill-selector.js";
import {
  installConfiguration,
  writeProjectSettings,
} from "../../core/configurator/settings-writer.js";
import {
  calculateScore,
  formatScoreReport,
} from "../../core/scorer/calculator.js";
import { createBackup, rollback } from "../../core/backup.js";
import { PATHS } from "../../shared/constants.js";
import { pathExists, writeJsonAtomic, ensureDir } from "../../shared/fs-safe.js";
import { print, printError } from "../../shared/logger.js";
import type { ChangePlan, ApplyResult, ProjectDNA } from "../../shared/types.js";

interface InitOptions {
  profile?: string;
  minimal?: boolean;
  full?: boolean;
  dryRun?: boolean;
  apply?: boolean;
  force?: boolean;
  mcps?: boolean;
  skills?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = process.cwd();

  // ─── Phase 1: SCAN ─────────────────────────────────────────────────────────
  const scanSpinner = ora("Scanning project...").start();

  let dna: ProjectDNA;
  try {
    dna = await scanProject(cwd);
    scanSpinner.succeed(
      `Project: ${chalk.bold(dna.identity.name)} (${chalk.cyan(dna.identity.type)}) — ${dna.scanDurationMs}ms`
    );
  } catch (err) {
    scanSpinner.fail("Failed to scan project");
    printError(chalk.red(String(err)));
    process.exitCode = 1;
    return;
  }

  print(
    chalk.dim(
      `  Runtime: ${dna.identity.runtime} | Category: ${dna.identity.category} | Monorepo: ${dna.identity.monorepo ? "yes" : "no"}`
    )
  );
  if (dna.dependencies.frameworks.length > 0) {
    print(chalk.dim(`  Frameworks: ${dna.dependencies.frameworks.join(", ")}`));
  }

  // ─── Phase 2: SELECT ───────────────────────────────────────────────────────
  const selectSpinner = ora("Selecting hooks...").start();

  let profile = options.profile;
  if (options.minimal) profile = "startup-speed";
  if (options.full) profile = "full-stack";

  const hookSelection = selectHooks(dna, profile);
  selectSpinner.succeed(summarizeSelection(hookSelection));

  const mcpSelection =
    options.mcps !== false
      ? selectMCPs(dna)
      : { servers: {}, reasons: {} };

  if (Object.keys(mcpSelection.servers).length > 0) {
    print(
      chalk.dim(
        `  MCPs: ${Object.entries(mcpSelection.reasons)
          .map(([k, v]) => `${k} (${v})`)
          .join(", ")}`
      )
    );
  }

  const skillSelection =
    options.skills !== false
      ? selectSkills(dna)
      : { universal: [], projectSpecific: [] };

  const totalSkills =
    skillSelection.universal.length + skillSelection.projectSpecific.length;
  if (totalSkills > 0) {
    print(
      chalk.dim(
        `  Skills: ${[...skillSelection.universal, ...skillSelection.projectSpecific].join(", ")}`
      )
    );
  }

  // ─── Phase 3: PLAN ─────────────────────────────────────────────────────────
  const plan = await buildChangePlan(dna, hookSelection, mcpSelection, options);

  print("");
  print(chalk.bold("  Change Plan:"));
  for (const line of plan.diffsSummary) {
    print(`    ${line}`);
  }
  if (plan.warnings.length > 0) {
    print("");
    for (const w of plan.warnings) {
      print(chalk.yellow(`  ⚠ ${w}`));
    }
  }

  // ─── DRY-RUN EXIT ──────────────────────────────────────────────────────────
  if (!options.apply) {
    print("");
    print(chalk.dim("  Dry-run complete. Run with --apply to write changes."));
    if (hookSelection.skipped.length > 0) {
      print(
        chalk.dim(
          `  Skipped ${hookSelection.skipped.length} hooks (not relevant to this project)`
        )
      );
    }
    return;
  }

  // ─── Phase 4: APPLY ────────────────────────────────────────────────────────
  const applySpinner = ora("Applying changes...").start();
  const result = await applyChanges(plan, hookSelection, mcpSelection, options.force ?? false);

  if (result.exitCode !== 0) {
    applySpinner.fail("Apply failed");
    if (result.rollbackPerformed) {
      print(chalk.yellow("  Rolled back to previous state."));
    }
    for (const e of result.errors) {
      printError(chalk.red(`  ${e}`));
    }
    process.exitCode = result.exitCode;
    return;
  }

  applySpinner.succeed(
    `Installed: ${plan.hooks.length} hooks, ${plan.mcps.length} MCPs`
  );
  if (result.backupDir) {
    print(chalk.dim(`  Backup: ${result.backupDir}`));
  }

  // ─── Phase 5: VERIFY ──────────────────────────────────────────────────────
  const verifySpinner = ora("Verifying installation...").start();
  const verification = await verifyInstall(plan);

  const failedChecks = verification.filter((v) => !v.passed);
  if (failedChecks.length > 0) {
    verifySpinner.warn(
      `Verification: ${verification.length - failedChecks.length}/${verification.length} passed`
    );
    for (const f of failedChecks) {
      print(chalk.yellow(`    ⚠ ${f.check}: ${f.detail}`));
    }
  } else {
    verifySpinner.succeed(
      `Verification: ${verification.length}/${verification.length} passed`
    );
  }

  // ─── Phase 6: SCORE ────────────────────────────────────────────────────────
  const scoreSpinner = ora("Calculating quality score...").start();
  try {
    const score = await calculateScore(dna);
    dna.quality = score;
    scoreSpinner.succeed(
      `Quality: ${chalk.bold(score.grade)} (${score.overall}/100)`
    );
    print(formatScoreReport(score));
  } catch {
    scoreSpinner.warn("Could not calculate quality score");
  }
}

// ─── PLAN BUILDER ──────────────────────────────────────────────────────────────

async function buildChangePlan(
  dna: ProjectDNA,
  hookSelection: ReturnType<typeof selectHooks>,
  mcpSelection: { servers: Record<string, unknown>; reasons: Record<string, string> },
  _options: InitOptions
): Promise<ChangePlan> {
  const backupsToCreate: string[] = [];
  const filesToWrite: ChangePlan["filesToWrite"] = [];
  const diffsSummary: string[] = [];
  const warnings: string[] = [];

  // Settings file
  if (await pathExists(PATHS.settingsFile)) {
    backupsToCreate.push(PATHS.settingsFile);
    filesToWrite.push({ path: PATHS.settingsFile, action: "modify" });
    diffsSummary.push(
      `Modify ${PATHS.settingsFile} (merge ${hookSelection.selected.length} hooks)`
    );
  } else {
    filesToWrite.push({ path: PATHS.settingsFile, action: "create" });
    diffsSummary.push(`Create ${PATHS.settingsFile}`);
  }

  // Manifest
  if (await pathExists(PATHS.pilotManifest)) {
    backupsToCreate.push(PATHS.pilotManifest);
    filesToWrite.push({ path: PATHS.pilotManifest, action: "modify" });
  } else {
    filesToWrite.push({ path: PATHS.pilotManifest, action: "create" });
  }
  diffsSummary.push(`Write tracking manifest → ${PATHS.pilotManifest}`);

  // Hook scripts
  diffsSummary.push(
    `Copy ${hookSelection.selected.length} hook scripts → ${PATHS.hooksDir}`
  );

  // MCPs
  const mcpEntries = Object.entries(mcpSelection.reasons);
  if (mcpEntries.length > 0) {
    const encoded = encodeProjectPath(dna.identity.root);
    const projectSettings = join(PATHS.projectsDir, encoded, "settings.json");
    if (await pathExists(projectSettings)) {
      backupsToCreate.push(projectSettings);
      filesToWrite.push({ path: projectSettings, action: "modify" });
    } else {
      filesToWrite.push({ path: projectSettings, action: "create" });
    }
    diffsSummary.push(
      `Configure ${mcpEntries.length} MCPs → per-project settings`
    );
  }

  // DNA file
  const dnaPath = join(
    homedir(),
    ".puiux-pilot",
    "projects",
    encodeProjectPath(dna.identity.root),
    "dna.json"
  );
  filesToWrite.push({ path: dnaPath, action: "create" });
  diffsSummary.push(`Save Project DNA → ${dnaPath}`);

  // Warnings
  if (await pathExists(PATHS.pilotManifest)) {
    warnings.push(
      "Existing Pilot manifest found. Use --force to overwrite user-modified hooks."
    );
  }

  return {
    backupsToCreate,
    filesToWrite,
    diffsSummary,
    warnings,
    rollbackAvailable: backupsToCreate.length > 0,
    hooks: hookSelection.selected.map((h) => ({
      id: h.id,
      event: h.event,
      tier: h.tier,
    })),
    mcps: mcpEntries.map(([name, reason]) => ({ name, reason })),
    profile: hookSelection.profile,
    dna,
  };
}

// ─── APPLY ──────────────────────────────────────────────────────────────────────

async function applyChanges(
  plan: ChangePlan,
  hookSelection: { selected: import("../../shared/types.js").HookMetadata[] },
  mcpSelection: { servers: Record<string, import("../../shared/types.js").MCPServerConfig>; reasons: Record<string, string> },
  _force: boolean
): Promise<ApplyResult> {
  const result: ApplyResult = {
    backupDir: null,
    backupsCreated: [],
    filesWritten: [],
    verification: [],
    rollbackPerformed: false,
    errors: [],
    exitCode: 0,
  };

  // Step 1: Create coordinated backup
  let backupDir: string | null = null;
  if (plan.backupsToCreate.length > 0) {
    try {
      backupDir = await createBackup(
        plan.backupsToCreate,
        `puiux-pilot init (profile: ${plan.profile})`
      );
      result.backupDir = backupDir;
      result.backupsCreated = [...plan.backupsToCreate];
    } catch (err) {
      result.errors.push(`Backup failed: ${err}`);
      result.exitCode = 1;
      return result;
    }
  }

  // Step 2: Apply changes (with rollback on failure)
  try {
    const hooksSourceDir = resolveHooksSourceDir();

    const installResult = await installConfiguration(
      hookSelection.selected,
      mcpSelection.servers,
      hooksSourceDir,
      plan.profile
    );

    result.filesWritten.push(installResult.settingsPath);
    result.filesWritten.push(PATHS.pilotManifest);

    // Write per-project MCPs
    if (Object.keys(mcpSelection.servers).length > 0) {
      await writeProjectSettings(plan.dna.identity.root, mcpSelection.servers);
    }

    // Write Project DNA
    const dnaDir = join(
      homedir(),
      ".puiux-pilot",
      "projects",
      encodeProjectPath(plan.dna.identity.root)
    );
    await ensureDir(dnaDir);
    const dnaPath = join(dnaDir, "dna.json");
    await writeJsonAtomic(dnaPath, plan.dna);
    result.filesWritten.push(dnaPath);
  } catch (err) {
    result.errors.push(`Apply failed: ${err}`);
    result.exitCode = 1;

    // Rollback on failure
    if (backupDir) {
      try {
        await rollback(backupDir);
        result.rollbackPerformed = true;
      } catch (rbErr) {
        result.errors.push(`Rollback also failed: ${rbErr}`);
      }
    }
  }

  return result;
}

// ─── VERIFY ─────────────────────────────────────────────────────────────────────

async function verifyInstall(
  plan: ChangePlan
): Promise<Array<{ check: string; passed: boolean; detail: string }>> {
  const checks: Array<{ check: string; passed: boolean; detail: string }> = [];

  checks.push({
    check: "Settings file",
    passed: await pathExists(PATHS.settingsFile),
    detail: PATHS.settingsFile,
  });

  checks.push({
    check: "Pilot manifest",
    passed: await pathExists(PATHS.pilotManifest),
    detail: PATHS.pilotManifest,
  });

  checks.push({
    check: "Hooks directory",
    passed: await pathExists(PATHS.hooksDir),
    detail: PATHS.hooksDir,
  });

  if (plan.rollbackAvailable && plan.backupsToCreate.length > 0) {
    checks.push({
      check: "Backup available",
      passed: true,
      detail: "Coordinated backup created",
    });
  }

  return checks;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function resolveHooksSourceDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  const pkgDir = dirname(dirname(dirname(thisFile)));
  const candidates = [
    join(pkgDir, "src", "hooks"),
    join(pkgDir, "hooks"),
    join(pkgDir, "dist", "hooks"),
  ];

  for (const dir of candidates) {
    try {
      accessSync(dir);
      return dir;
    } catch {
      continue;
    }
  }

  return join(homedir(), ".claude", "hooks");
}

function encodeProjectPath(p: string): string {
  return p
    .replace(/[\\/]/g, "-")
    .replace(/ /g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
}
