/**
 * Tests for fs-safe.ts — atomic writes, ensureDir, readJsonSafe, writeJsonAtomic
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, readFile, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  ensureDir,
  atomicWrite,
  readJsonSafe,
  writeJsonAtomic,
  pathExists,
  copyFileAtomic,
} from "../src/shared/fs-safe.js";

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "pilot-test-"));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("ensureDir", () => {
  it("creates nested directories", async () => {
    const nested = join(testDir, "a", "b", "c");
    await ensureDir(nested);
    expect(await pathExists(nested)).toBe(true);
  });

  it("is idempotent — calling twice is fine", async () => {
    const dir = join(testDir, "idem");
    await ensureDir(dir);
    await ensureDir(dir);
    expect(await pathExists(dir)).toBe(true);
  });
});

describe("atomicWrite", () => {
  it("writes file content correctly", async () => {
    const file = join(testDir, "test.txt");
    await atomicWrite(file, "hello world");
    const content = await readFile(file, "utf-8");
    expect(content).toBe("hello world");
  });

  it("creates parent directories if needed", async () => {
    const file = join(testDir, "deep", "nested", "file.txt");
    await atomicWrite(file, "nested content");
    const content = await readFile(file, "utf-8");
    expect(content).toBe("nested content");
  });

  it("does not leave temp files on success", async () => {
    const file = join(testDir, "clean.txt");
    await atomicWrite(file, "data");
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(testDir);
    expect(entries).toEqual(["clean.txt"]);
  });

  it("overwrites existing file atomically", async () => {
    const file = join(testDir, "overwrite.txt");
    await writeFile(file, "original", "utf-8");
    await atomicWrite(file, "updated");
    const content = await readFile(file, "utf-8");
    expect(content).toBe("updated");
  });
});

describe("readJsonSafe", () => {
  it("reads valid JSON", async () => {
    const file = join(testDir, "data.json");
    await writeFile(file, '{"key": "value"}', "utf-8");
    const result = await readJsonSafe<{ key: string }>(file);
    expect(result).toEqual({ key: "value" });
  });

  it("returns null for missing file", async () => {
    const result = await readJsonSafe(join(testDir, "missing.json"));
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", async () => {
    const file = join(testDir, "bad.json");
    await writeFile(file, "not json{", "utf-8");
    const result = await readJsonSafe(file);
    expect(result).toBeNull();
  });
});

describe("writeJsonAtomic", () => {
  it("writes pretty-printed JSON with trailing newline", async () => {
    const file = join(testDir, "out.json");
    await writeJsonAtomic(file, { a: 1, b: [2, 3] });
    const raw = await readFile(file, "utf-8");
    expect(raw).toBe('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}\n');
  });

  it("round-trips through readJsonSafe", async () => {
    const file = join(testDir, "roundtrip.json");
    const data = { name: "pilot", version: 1, nested: { ok: true } };
    await writeJsonAtomic(file, data);
    const result = await readJsonSafe(file);
    expect(result).toEqual(data);
  });
});

describe("copyFileAtomic", () => {
  it("copies file content correctly", async () => {
    const src = join(testDir, "src.txt");
    const dest = join(testDir, "dest.txt");
    await writeFile(src, "copy me", "utf-8");
    await copyFileAtomic(src, dest);
    const content = await readFile(dest, "utf-8");
    expect(content).toBe("copy me");
  });

  it("creates parent directories for destination", async () => {
    const src = join(testDir, "src2.txt");
    const dest = join(testDir, "sub", "dir", "dest2.txt");
    await writeFile(src, "nested copy", "utf-8");
    await copyFileAtomic(src, dest);
    const content = await readFile(dest, "utf-8");
    expect(content).toBe("nested copy");
  });
});

describe("pathExists", () => {
  it("returns true for existing file", async () => {
    const file = join(testDir, "exists.txt");
    await writeFile(file, "", "utf-8");
    expect(await pathExists(file)).toBe(true);
  });

  it("returns false for missing file", async () => {
    expect(await pathExists(join(testDir, "nope.txt"))).toBe(false);
  });

  it("returns true for existing directory", async () => {
    expect(await pathExists(testDir)).toBe(true);
  });
});
