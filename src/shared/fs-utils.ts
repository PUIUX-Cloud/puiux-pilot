/**
 * Filesystem Utilities
 * Pure ESM — no require() calls.
 */

import { readFile, access, stat } from "node:fs/promises";
import { accessSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { atomicWrite, writeJsonAtomic, ensureDir } from "./fs-safe.js";

/** Read a JSON file, return null if missing or invalid */
export async function readJSON<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Write JSON with pretty formatting. Uses atomic write (temp+rename). */
export async function writeJSON(path: string, data: unknown): Promise<void> {
  await writeJsonAtomic(path, data);
}

/** Deep merge two objects. Arrays are replaced, not concatenated. */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };
  for (const key of Object.keys(source) as (keyof T)[]) {
    const sv = source[key];
    const tv = target[key];
    if (
      sv !== null &&
      typeof sv === "object" &&
      !Array.isArray(sv) &&
      tv !== null &&
      typeof tv === "object" &&
      !Array.isArray(tv)
    ) {
      (result as Record<string, unknown>)[key as string] = deepMerge(
        tv as Record<string, unknown>,
        sv as Record<string, unknown>
      );
    } else if (sv !== undefined) {
      (result as Record<string, unknown>)[key as string] = sv;
    }
  }
  return result;
}

/** Check if a file exists */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Get file size in bytes, 0 if missing */
export async function fileSize(path: string): Promise<number> {
  try {
    const s = await stat(path);
    return s.size;
  } catch {
    return 0;
  }
}

/** Compute SHA-256 hash of a file */
export async function fileHash(path: string): Promise<string> {
  try {
    const content = await readFile(path);
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
  } catch {
    return "";
  }
}

/** Read a text file, return empty string if missing */
export async function readText(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Walk up from a directory looking for a specific file.
 * Pure ESM — uses accessSync from node:fs (static import).
 */
export function findUpSync(
  startDir: string,
  filename: string,
  maxDepth = 10
): string | null {
  let dir = startDir;
  for (let i = 0; i < maxDepth; i++) {
    const candidate = join(dir, filename);
    try {
      accessSync(candidate);
      return dir;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  }
  return null;
}
