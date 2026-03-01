/**
 * Safe Filesystem Utilities
 * Atomic writes, ensureDir, safe JSON operations
 * All writes use temp-then-rename to prevent partial files on crash.
 */

import {
  readFile,
  writeFile,
  rename,
  mkdir,
  unlink,
  copyFile,
  stat,
  access,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";

/**
 * Ensure a directory exists, creating parent dirs as needed.
 * No-op if already exists. Returns the resolved path.
 */
export async function ensureDir(dirPath: string): Promise<string> {
  await mkdir(dirPath, { recursive: true });
  return dirPath;
}

/**
 * Atomic write: writes to a temp file in the same directory, then renames.
 * This guarantees that the target file is either fully written or untouched.
 * On crash, only the temp file is left (cleaned up on next run).
 */
export async function atomicWrite(
  filePath: string,
  content: string | Buffer
): Promise<void> {
  const dir = dirname(filePath);
  await ensureDir(dir);

  const suffix = randomBytes(6).toString("hex");
  const tempPath = join(dir, `.tmp-pilot-${suffix}`);

  try {
    await writeFile(tempPath, content, typeof content === "string" ? "utf-8" : undefined);
    await rename(tempPath, filePath);
  } catch (err) {
    // Clean up temp file on failure
    try {
      await unlink(tempPath);
    } catch {
      // temp file may not exist
    }
    throw err;
  }
}

/**
 * Read a JSON file safely. Returns null if file is missing or has invalid JSON.
 * Never throws.
 */
export async function readJsonSafe<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Write JSON atomically with pretty formatting.
 * Ensures parent directory exists. Uses temp-then-rename.
 */
export async function writeJsonAtomic(
  path: string,
  data: unknown
): Promise<void> {
  const content = JSON.stringify(data, null, 2) + "\n";
  await atomicWrite(path, content);
}

/**
 * Copy a file atomically to a destination.
 * Ensures destination directory exists.
 */
export async function copyFileAtomic(
  src: string,
  dest: string
): Promise<void> {
  const dir = dirname(dest);
  await ensureDir(dir);

  const suffix = randomBytes(6).toString("hex");
  const tempPath = join(dir, `.tmp-pilot-${suffix}`);

  try {
    await copyFile(src, tempPath);
    await rename(tempPath, dest);
  } catch (err) {
    try {
      await unlink(tempPath);
    } catch {
      // ignore
    }
    throw err;
  }
}

/**
 * Check if a file or directory exists. Never throws.
 */
export async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a text file. Returns empty string if missing. Never throws.
 */
export async function readTextSafe(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return "";
  }
}
