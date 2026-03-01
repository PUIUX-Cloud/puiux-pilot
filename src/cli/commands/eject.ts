/**
 * puiux-pilot eject
 * Remove all PUIUX Pilot managed hooks and configuration.
 * Creates a coordinated backup first. Rolls back on failure.
 */

import chalk from "chalk";
import ora from "ora";
import { uninstallConfiguration } from "../../core/configurator/settings-writer.js";
import { readJSON } from "../../shared/fs-utils.js";
import { PATHS } from "../../shared/constants.js";
import { unlink } from "node:fs/promises";
import { createBackup, rollback } from "../../core/backup.js";
import { pathExists } from "../../shared/fs-safe.js";
import { print } from "../../shared/logger.js";
import type { PilotManifest } from "../../shared/types.js";

interface EjectOptions {
  keepHooks?: boolean;
  force?: boolean;
}

export async function ejectCommand(_options: EjectOptions): Promise<void> {
  const manifest = await readJSON<PilotManifest>(PATHS.pilotManifest);
  if (!manifest) {
    print(chalk.dim("  PUIUX Pilot is not installed (no manifest found)."));
    return;
  }

  // Build list of files to backup (with proper await)
  const filesToBackup: string[] = [];
  if (await pathExists(PATHS.settingsFile)) filesToBackup.push(PATHS.settingsFile);
  if (await pathExists(PATHS.pilotManifest)) filesToBackup.push(PATHS.pilotManifest);

  // Create coordinated backup
  let backupDir: string | null = null;
  const backupSpinner = ora("Creating backup...").start();
  try {
    if (filesToBackup.length > 0) {
      backupDir = await createBackup(filesToBackup, "puiux-pilot eject");
      backupSpinner.succeed(`Backup created: ${chalk.dim(backupDir)}`);
    } else {
      backupSpinner.succeed("No files to backup");
    }
  } catch (err) {
    backupSpinner.warn(`Could not create backup: ${err}`);
  }

  // Remove hook entries from settings.json (with rollback on failure)
  const spinner = ora("Removing hook entries from settings.json...").start();
  try {
    const result = await uninstallConfiguration();
    spinner.succeed(`Removed ${result.hooksRemoved} hook entries`);
  } catch (err) {
    spinner.fail("Failed to remove hook entries");
    process.stderr.write(chalk.red(`  ${err}\n`));

    // Rollback if backup exists
    if (backupDir) {
      print(chalk.yellow("  Rolling back..."));
      const rb = await rollback(backupDir);
      if (rb.errors.length > 0) {
        for (const e of rb.errors) print(chalk.red(`  ${e}`));
      } else {
        print(chalk.green(`  Rolled back ${rb.restored.length} files`));
      }
    }
    process.exitCode = 1;
    return;
  }

  // Remove manifest
  try {
    await unlink(PATHS.pilotManifest);
    print(chalk.dim("  Removed pilot manifest"));
  } catch {
    // ok — might not exist
  }

  print("");
  print(chalk.green("  Eject complete. PUIUX Pilot hooks have been removed."));
  if (backupDir) {
    print(chalk.dim(`  Backup at: ${backupDir}`));
  }
}
