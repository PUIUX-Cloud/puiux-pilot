/**
 * Backup + Rollback Mechanism
 * Stores coordinated backups with a manifest for atomic rollback.
 *
 * Backup dir: ~/.puiux-pilot/backups/<timestamp>/
 * Each backup has a manifest.json mapping original → backup paths.
 * Backup filenames use hash of original path to avoid basename collisions.
 */

import { readdir, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import {
  ensureDir,
  readJsonSafe,
  writeJsonAtomic,
  pathExists,
  copyFileAtomic,
} from "../shared/fs-safe.js";

const BACKUPS_ROOT = join(homedir(), ".puiux-pilot", "backups");

export interface BackupManifest {
  createdAt: string;
  reason: string;
  entries: BackupEntry[];
}

export interface BackupEntry {
  originalPath: string;
  backupPath: string;
  existed: boolean; // false means file was created new (rollback = delete)
}

/**
 * Generate a unique backup filename from the original path.
 * Uses a short hash of the full path to prevent collisions.
 * Example: settings.json.a1b2c3d4.bak
 */
function backupFilename(originalPath: string): string {
  const hash = createHash("sha256")
    .update(originalPath)
    .digest("hex")
    .slice(0, 8);
  // Extract the last path component for readability
  const name = originalPath.split(/[\\/]/).pop() || "file";
  return `${name}.${hash}.bak`;
}

/**
 * Create a coordinated backup of multiple files.
 * All copies are atomic (temp+rename). Returns the backup directory path.
 */
export async function createBackup(
  files: string[],
  reason: string
): Promise<string> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(BACKUPS_ROOT, ts);
  await ensureDir(backupDir);

  const entries: BackupEntry[] = [];

  for (const file of files) {
    const existed = await pathExists(file);
    const bkName = backupFilename(file);
    const backupPath = join(backupDir, bkName);

    if (existed) {
      await copyFileAtomic(file, backupPath);
    }

    entries.push({ originalPath: file, backupPath, existed });
  }

  const manifest: BackupManifest = {
    createdAt: new Date().toISOString(),
    reason,
    entries,
  };

  await writeJsonAtomic(join(backupDir, "manifest.json"), manifest);
  return backupDir;
}

/**
 * Rollback from a backup directory.
 * Restores files that existed (ensuring parent dirs exist).
 * Deletes files that were newly created during the run.
 * All restores are atomic (copyFileAtomic).
 */
export async function rollback(backupDir: string): Promise<{
  restored: string[];
  deleted: string[];
  errors: string[];
}> {
  const manifestPath = join(backupDir, "manifest.json");
  const manifest = await readJsonSafe<BackupManifest>(manifestPath);

  if (!manifest) {
    return {
      restored: [],
      deleted: [],
      errors: [`No manifest found at ${manifestPath}`],
    };
  }

  const restored: string[] = [];
  const deleted: string[] = [];
  const errors: string[] = [];

  for (const entry of manifest.entries) {
    try {
      if (entry.existed) {
        // Ensure parent directory exists before restoring
        await ensureDir(dirname(entry.originalPath));
        await copyFileAtomic(entry.backupPath, entry.originalPath);
        restored.push(entry.originalPath);
      } else {
        // File was created new during the run — remove it
        if (await pathExists(entry.originalPath)) {
          await unlink(entry.originalPath);
          deleted.push(entry.originalPath);
        }
      }
    } catch (err) {
      errors.push(`Failed to rollback ${entry.originalPath}: ${err}`);
    }
  }

  return { restored, deleted, errors };
}

/**
 * List available backups, newest first.
 */
export async function listBackups(): Promise<
  Array<{ dir: string; manifest: BackupManifest }>
> {
  if (!(await pathExists(BACKUPS_ROOT))) return [];

  try {
    const dirs = await readdir(BACKUPS_ROOT);
    const results: Array<{ dir: string; manifest: BackupManifest }> = [];

    for (const dir of dirs.sort().reverse()) {
      const manifestPath = join(BACKUPS_ROOT, dir, "manifest.json");
      const manifest = await readJsonSafe<BackupManifest>(manifestPath);
      if (manifest) {
        results.push({ dir: join(BACKUPS_ROOT, dir), manifest });
      }
    }

    return results;
  } catch {
    return [];
  }
}
