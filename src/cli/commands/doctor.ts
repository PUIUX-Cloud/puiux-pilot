/**
 * puiux-pilot doctor
 * Health check for Claude Code setup. READ-ONLY.
 */

import chalk from "chalk";
import { join } from "node:path";
import { readdir, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { PATHS } from "../../shared/constants.js";
import { readJSON, fileExists } from "../../shared/fs-utils.js";
import { print } from "../../shared/logger.js";
import type { ClaudeSettings, PilotManifest } from "../../shared/types.js";

interface DoctorOptions {
  fix?: boolean;
}

interface Check {
  name: string;
  status: "ok" | "warn" | "error";
  message: string;
}

export async function doctorCommand(_options: DoctorOptions): Promise<void> {
  print("");
  print(chalk.bold("  PUIUX Pilot Doctor"));
  print("");

  const checks: Check[] = [];

  checks.push(await checkDir("Claude directory", PATHS.claudeDir));
  checks.push(await checkDir("Hooks directory", PATHS.hooksDir));
  checks.push(await checkSettingsFile());
  checks.push(await checkHookScripts());
  checks.push(await checkHookPermissions());
  checks.push(await checkManifest());
  checks.push(await checkOrphanHooks());

  let errors = 0;
  let warnings = 0;

  for (const check of checks) {
    const icon =
      check.status === "ok"
        ? chalk.green("✓")
        : check.status === "warn"
          ? chalk.yellow("⚠")
          : chalk.red("✗");

    print(`  ${icon} ${check.name}: ${check.message}`);

    if (check.status === "error") errors++;
    if (check.status === "warn") warnings++;
  }

  print("");
  if (errors > 0) {
    print(chalk.red(`  ${errors} error(s), ${warnings} warning(s)`));
    process.exitCode = 1;
  } else if (warnings > 0) {
    print(chalk.yellow(`  ${warnings} warning(s), no errors`));
  } else {
    print(chalk.green("  All checks passed"));
  }
}

async function checkDir(name: string, path: string): Promise<Check> {
  if (await fileExists(path)) {
    return { name, status: "ok", message: "exists" };
  }
  return { name, status: "error", message: `not found at ${path}` };
}

async function checkSettingsFile(): Promise<Check> {
  const settings = await readJSON<ClaudeSettings>(PATHS.settingsFile);
  if (!settings) {
    return {
      name: "Settings file",
      status: "error",
      message: "~/.claude/settings.json missing or invalid",
    };
  }
  return { name: "Settings file", status: "ok", message: "valid JSON" };
}

async function checkHookScripts(): Promise<Check> {
  const settings = await readJSON<ClaudeSettings>(PATHS.settingsFile);
  if (!settings?.hooks) {
    return { name: "Hook scripts", status: "warn", message: "no hooks configured" };
  }

  let missing = 0;
  let total = 0;

  for (const [, groups] of Object.entries(settings.hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!group.hooks) continue;
      for (const hook of group.hooks) {
        total++;
        if (!(await fileExists(hook.command))) {
          missing++;
        }
      }
    }
  }

  if (missing > 0) {
    return {
      name: "Hook scripts",
      status: "error",
      message: `${missing}/${total} hook scripts not found`,
    };
  }
  return { name: "Hook scripts", status: "ok", message: `${total} hooks, all present` };
}

async function checkHookPermissions(): Promise<Check> {
  if (!(await fileExists(PATHS.hooksDir))) {
    return { name: "Hook permissions", status: "warn", message: "hooks directory missing" };
  }

  // X_OK (execute permission) is a Unix concept — skip on Windows
  if (process.platform === "win32") {
    return {
      name: "Hook permissions",
      status: "warn",
      message: "execute-bit check skipped on Windows (not applicable)",
    };
  }

  try {
    const entries = await readdir(PATHS.hooksDir);
    const shellScripts = entries.filter((e) => e.endsWith(".sh"));
    let nonExecutable = 0;

    for (const script of shellScripts) {
      try {
        await access(join(PATHS.hooksDir, script), fsConstants.X_OK);
      } catch {
        nonExecutable++;
      }
    }

    if (nonExecutable > 0) {
      return {
        name: "Hook permissions",
        status: "warn",
        message: `${nonExecutable}/${shellScripts.length} scripts not executable`,
      };
    }
    return {
      name: "Hook permissions",
      status: "ok",
      message: `${shellScripts.length} scripts, all executable`,
    };
  } catch {
    return { name: "Hook permissions", status: "warn", message: "could not check" };
  }
}

async function checkManifest(): Promise<Check> {
  const manifest = await readJSON<PilotManifest>(PATHS.pilotManifest);
  if (!manifest) {
    return {
      name: "Pilot manifest",
      status: "warn",
      message: "not found — run `puiux-pilot init --apply` to create",
    };
  }
  return {
    name: "Pilot manifest",
    status: "ok",
    message: `v${manifest.version}, ${manifest.managedHooks.length} managed hooks, profile: ${manifest.profile}`,
  };
}

async function checkOrphanHooks(): Promise<Check> {
  if (!(await fileExists(PATHS.hooksDir))) {
    return { name: "Orphan hooks", status: "ok", message: "no hooks directory" };
  }

  const settings = await readJSON<ClaudeSettings>(PATHS.settingsFile);
  const wiredPaths = new Set<string>();

  if (settings?.hooks) {
    for (const [, groups] of Object.entries(settings.hooks)) {
      if (!Array.isArray(groups)) continue;
      for (const group of groups) {
        if (!group.hooks) continue;
        for (const hook of group.hooks) {
          wiredPaths.add(hook.command);
        }
      }
    }
  }

  try {
    const entries = await readdir(PATHS.hooksDir);
    const shellScripts = entries.filter((e) => e.endsWith(".sh"));
    const orphans = shellScripts.filter(
      (s) => !wiredPaths.has(join(PATHS.hooksDir, s))
    );

    if (orphans.length > 0) {
      return {
        name: "Orphan hooks",
        status: "warn",
        message: `${orphans.length} scripts not wired: ${orphans.slice(0, 3).join(", ")}${orphans.length > 3 ? "..." : ""}`,
      };
    }
    return { name: "Orphan hooks", status: "ok", message: "none found" };
  } catch {
    return { name: "Orphan hooks", status: "ok", message: "could not check" };
  }
}
