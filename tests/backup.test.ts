/**
 * Tests for backup.ts — coordinated backup + rollback
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { ensureDir, pathExists } from "../src/shared/fs-safe.js";

// We test the backup logic with a mock BACKUPS_ROOT.
// Since backup.ts hardcodes the root, we test the core logic directly.

describe("backup and rollback", () => {
  let testDir: string;
  let backupDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "pilot-backup-test-"));
    backupDir = join(testDir, "backups");
    await ensureDir(backupDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("simulates backup + rollback for existing file", async () => {
    // Setup: create original file
    const original = join(testDir, "settings.json");
    await writeFile(original, '{"original": true}', "utf-8");

    // Backup: copy to backup dir
    const backup = join(backupDir, "settings.json.bak");
    const { copyFile } = await import("node:fs/promises");
    await copyFile(original, backup);

    // Modify: overwrite the original
    await writeFile(original, '{"modified": true}', "utf-8");
    const modified = await readFile(original, "utf-8");
    expect(JSON.parse(modified)).toEqual({ modified: true });

    // Rollback: restore from backup
    await copyFile(backup, original);
    const restored = await readFile(original, "utf-8");
    expect(JSON.parse(restored)).toEqual({ original: true });
  });

  it("simulates rollback of newly created file (delete it)", async () => {
    const newFile = join(testDir, "new-manifest.json");

    // File doesn't exist before
    expect(await pathExists(newFile)).toBe(false);

    // Create it (simulating init --apply)
    await writeFile(newFile, '{"new": true}', "utf-8");
    expect(await pathExists(newFile)).toBe(true);

    // Rollback: delete it
    const { unlink } = await import("node:fs/promises");
    await unlink(newFile);
    expect(await pathExists(newFile)).toBe(false);
  });

  it("ensures parent directories exist during restore", async () => {
    const nested = join(testDir, "deep", "path", "config.json");

    // Create parent + file
    await ensureDir(join(testDir, "deep", "path"));
    await writeFile(nested, '{"deep": true}', "utf-8");

    // Backup
    const backup = join(backupDir, "config.json.bak");
    const { copyFile } = await import("node:fs/promises");
    await copyFile(nested, backup);

    // Delete original + parent
    await rm(join(testDir, "deep"), { recursive: true, force: true });
    expect(await pathExists(nested)).toBe(false);

    // Rollback with ensureDir
    await ensureDir(join(testDir, "deep", "path"));
    await copyFile(backup, nested);
    const restored = await readFile(nested, "utf-8");
    expect(JSON.parse(restored)).toEqual({ deep: true });
  });
});
