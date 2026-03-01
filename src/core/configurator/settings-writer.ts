/**
 * Settings Writer
 * Safely merges hooks and MCPs into ~/.claude/settings.json
 * CRITICAL: Never replaces — always merges. Preserves user-added hooks.
 * All writes are atomic (temp+rename). Idempotent (run twice = same result).
 */

import { join } from "node:path";
import { chmod } from "node:fs/promises";
import type {
  HookMetadata,
  ClaudeSettings,
  ClaudeHookGroup,
  ClaudeHookEntry,
  MCPServerConfig,
  PilotManifest,
} from "../../shared/types.js";
import { PATHS, VERSION } from "../../shared/constants.js";
import { fileHash } from "../../shared/fs-utils.js";
import {
  ensureDir,
  writeJsonAtomic,
  readJsonSafe,
  pathExists,
  copyFileAtomic,
} from "../../shared/fs-safe.js";

export interface WriteResult {
  hooksInstalled: number;
  mcpsAdded: number;
  settingsPath: string;
}

/**
 * Install hooks and MCPs into Claude settings.
 * 1. Copy hook scripts to ~/.claude/hooks/
 * 2. Merge hook entries into settings.json (idempotent)
 * 3. Write tracking manifest
 * All writes are atomic.
 */
export async function installConfiguration(
  hooks: HookMetadata[],
  mcps: Record<string, MCPServerConfig>,
  hooksSourceDir: string,
  profile: string
): Promise<WriteResult> {
  // Step 1: Copy hook scripts
  await copyHookScripts(hooks, hooksSourceDir);

  // Step 2: Read existing settings
  const existing =
    (await readJsonSafe<ClaudeSettings>(PATHS.settingsFile)) || {};

  // Step 3: Merge hooks (idempotent — duplicates are skipped)
  const merged = mergeHooks(existing, hooks);

  // Step 4: Preserve existing MCPs
  merged.mcpServers = existing.mcpServers || {};

  // Step 5: Write merged settings atomically
  await writeJsonAtomic(PATHS.settingsFile, merged);

  // Step 6: Write tracking manifest
  await writeManifest(hooks, Object.keys(mcps), profile, hooksSourceDir);

  return {
    hooksInstalled: hooks.length,
    mcpsAdded: Object.keys(mcps).length,
    settingsPath: PATHS.settingsFile,
  };
}

/**
 * Write per-project settings (MCPs).
 * Atomic write, preserves existing user-added MCPs.
 */
export async function writeProjectSettings(
  projectRoot: string,
  mcps: Record<string, MCPServerConfig>
): Promise<void> {
  const encoded = encodeProjectPath(projectRoot);
  const projectSettingsDir = join(PATHS.projectsDir, encoded);
  await ensureDir(projectSettingsDir);

  const settingsPath = join(projectSettingsDir, "settings.json");
  const existing =
    (await readJsonSafe<{ mcpServers?: Record<string, MCPServerConfig> }>(
      settingsPath
    )) || {};

  const merged = {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers || {}),
      ...mcps,
    },
  };

  await writeJsonAtomic(settingsPath, merged);
}

/**
 * Remove all PUIUX Pilot managed hooks from settings.
 * Atomic write. Does not touch non-managed hooks.
 */
export async function uninstallConfiguration(): Promise<{
  hooksRemoved: number;
}> {
  const manifest = await readJsonSafe<PilotManifest>(PATHS.pilotManifest);
  if (!manifest) {
    return { hooksRemoved: 0 };
  }

  const settings =
    (await readJsonSafe<ClaudeSettings>(PATHS.settingsFile)) || {};

  let removed = 0;
  if (settings.hooks) {
    for (const [event, groups] of Object.entries(settings.hooks)) {
      if (!Array.isArray(groups)) continue;
      for (const group of groups) {
        if (!group.hooks || !Array.isArray(group.hooks)) continue;
        const before = group.hooks.length;
        group.hooks = group.hooks.filter((h: ClaudeHookEntry) => {
          return !manifest.managedHooks.some((id) => {
            const hookPath = join(PATHS.hooksDir, id + ".sh");
            return h.command === hookPath;
          });
        });
        removed += before - group.hooks.length;
      }

      // Remove empty groups
      settings.hooks[event] = groups.filter(
        (g: ClaudeHookGroup) => g.hooks && g.hooks.length > 0
      );
    }
  }

  await writeJsonAtomic(PATHS.settingsFile, settings);

  return { hooksRemoved: removed };
}

// ─── Internal Functions ──────────────────────────────────────────────────────

async function copyHookScripts(
  hooks: HookMetadata[],
  sourceDir: string
): Promise<void> {
  await ensureDir(PATHS.hooksDir);
  await ensureDir(join(PATHS.hooksDir, "lib"));

  // Read manifest ONCE (not per-hook)
  const manifest = await readJsonSafe<PilotManifest>(PATHS.pilotManifest);

  // Copy shared library first
  const libSource = join(sourceDir, "lib", "hook-common.sh");
  const libDest = join(PATHS.hooksDir, "lib", "hook-common.sh");
  if (await pathExists(libSource)) {
    await copyFileAtomic(libSource, libDest);
    await chmod(libDest, 0o755);
  }

  for (const hook of hooks) {
    const source = join(sourceDir, hook.script);
    if (!(await pathExists(source))) continue;

    const destName = hook.id + ".sh";
    const dest = join(PATHS.hooksDir, destName);

    // Skip if user has customized (check hash against manifest)
    if (manifest?.hookHashes?.[hook.id]) {
      const currentHash = await fileHash(dest);
      if (currentHash && currentHash !== manifest.hookHashes[hook.id]) {
        continue;
      }
    }

    await copyFileAtomic(source, dest);
    await chmod(dest, 0o755);
  }
}

/**
 * Merge hooks into settings. IDEMPOTENT — will not add duplicate entries.
 */
function mergeHooks(
  existing: ClaudeSettings,
  hooks: HookMetadata[]
): ClaudeSettings {
  const result: ClaudeSettings = { ...existing };
  if (!result.hooks) result.hooks = {};

  const groups = new Map<string, HookMetadata[]>();
  for (const hook of hooks) {
    const key = `${hook.event}:${hook.matcher || ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(hook);
  }

  for (const [key, hookGroup] of groups) {
    const [event, matcher] = key.split(":");
    if (!result.hooks[event]) {
      result.hooks[event] = [];
    }

    let existingGroup = (result.hooks[event] as ClaudeHookGroup[]).find(
      (g) => (g.matcher || "") === matcher
    );

    if (!existingGroup) {
      existingGroup = {
        hooks: [],
        ...(matcher ? { matcher } : {}),
      };
      (result.hooks[event] as ClaudeHookGroup[]).push(existingGroup);
    }

    // Idempotency: skip hooks already present by command path
    for (const hook of hookGroup) {
      const hookPath = join(PATHS.hooksDir, hook.id + ".sh");
      const alreadyExists = existingGroup.hooks.some(
        (h) => h.command === hookPath
      );

      if (!alreadyExists) {
        existingGroup.hooks.push({
          type: "command",
          command: hookPath,
          timeout: hook.timeout,
        });
      }
    }
  }

  return result;
}

async function writeManifest(
  hooks: HookMetadata[],
  mcpIds: string[],
  profile: string,
  sourceDir: string
): Promise<void> {
  const hookHashes: Record<string, string> = {};
  for (const hook of hooks) {
    const source = join(sourceDir, hook.script);
    hookHashes[hook.id] = await fileHash(source);
  }

  const manifest: PilotManifest = {
    version: VERSION,
    installedAt: new Date().toISOString(),
    lastScan: new Date().toISOString(),
    profile,
    managedHooks: hooks.map((h) => h.id),
    managedSkills: [],
    managedMCPs: mcpIds,
    hookHashes,
    projectDNA: null,
  };

  await writeJsonAtomic(PATHS.pilotManifest, manifest);
}

function encodeProjectPath(path: string): string {
  // Cross-platform: normalize both / and \ separators
  return path
    .replace(/[\\/]/g, "-")
    .replace(/ /g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
}
