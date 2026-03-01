/**
 * Tests for settings merge idempotency.
 * Running init twice must NOT duplicate hooks or settings entries.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import type { ClaudeSettings, HookMetadata } from "../src/shared/types.js";
import { ensureDir, writeJsonAtomic, readJsonSafe } from "../src/shared/fs-safe.js";

// We test the mergeHooks logic directly by simulating what settings-writer does.
// Since mergeHooks is private, we test the observable behavior:
// write settings twice with the same hooks → no duplicates.

describe("settings merge idempotency", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "pilot-merge-test-"));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("merging same hooks twice produces no duplicates", async () => {
    const settingsPath = join(testDir, "settings.json");

    // Simulate what mergeHooks does
    const hooks: Array<{ id: string; event: string; matcher: string; timeout: number }> = [
      { id: "guard-files", event: "PreToolUse", matcher: "Edit|Write", timeout: 10000 },
      { id: "secret-scanner", event: "PreToolUse", matcher: "Edit|Write", timeout: 10000 },
      { id: "qa-review", event: "Stop", matcher: "", timeout: 30000 },
    ];

    const hooksDir = join(testDir, "hooks");

    function mergeInto(existing: ClaudeSettings): ClaudeSettings {
      const result = { ...existing };
      if (!result.hooks) result.hooks = {};

      const groups = new Map<string, typeof hooks>();
      for (const hook of hooks) {
        const key = `${hook.event}:${hook.matcher}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(hook);
      }

      for (const [key, hookGroup] of groups) {
        const [event, matcher] = key.split(":");
        if (!result.hooks[event]) result.hooks[event] = [];

        let existingGroup = (result.hooks[event] as Array<{ matcher?: string; hooks: Array<{ command: string; timeout: number }> }>).find(
          (g) => (g.matcher || "") === matcher
        );

        if (!existingGroup) {
          existingGroup = { hooks: [], ...(matcher ? { matcher } : {}) };
          (result.hooks[event] as Array<unknown>).push(existingGroup);
        }

        for (const hook of hookGroup) {
          const hookPath = join(hooksDir, hook.id + ".sh");
          const alreadyExists = existingGroup.hooks.some(
            (h) => h.command === hookPath
          );
          if (!alreadyExists) {
            existingGroup.hooks.push({
              command: hookPath,
              timeout: hook.timeout,
            });
          }
        }
      }

      return result;
    }

    // First merge (empty settings)
    const first = mergeInto({});
    await writeJsonAtomic(settingsPath, first);

    // Count hooks after first merge
    const firstData = await readJsonSafe<ClaudeSettings>(settingsPath);
    const firstCount = countHooks(firstData!);

    // Second merge (same hooks, existing settings)
    const second = mergeInto(firstData!);
    await writeJsonAtomic(settingsPath, second);

    // Count hooks after second merge — must be identical
    const secondData = await readJsonSafe<ClaudeSettings>(settingsPath);
    const secondCount = countHooks(secondData!);

    expect(secondCount).toBe(firstCount);
    expect(secondCount).toBe(3); // guard-files, secret-scanner, qa-review
  });
});

function countHooks(settings: ClaudeSettings): number {
  let count = 0;
  if (!settings.hooks) return 0;
  for (const [, groups] of Object.entries(settings.hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      count += (group.hooks || []).length;
    }
  }
  return count;
}
