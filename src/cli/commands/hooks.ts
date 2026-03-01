/**
 * puiux-pilot hooks [action] [name]
 * Manage hooks: list, info. READ-ONLY.
 */

import chalk from "chalk";
import { HOOKS_MANIFEST, getHookById } from "../../registry/hooks-manifest.js";
import { readJSON } from "../../shared/fs-utils.js";
import { PATHS } from "../../shared/constants.js";
import { print } from "../../shared/logger.js";
import type { ClaudeSettings, PilotManifest } from "../../shared/types.js";

export async function hooksCommand(
  action: string,
  name: string | undefined
): Promise<void> {
  switch (action) {
    case "list":
      await listHooks();
      break;
    case "info":
      if (!name) {
        process.stderr.write(chalk.red("  Usage: puiux-pilot hooks info <name>\n"));
        process.exitCode = 1;
        return;
      }
      infoHook(name);
      break;
    default:
      await listHooks();
  }
}

async function listHooks(): Promise<void> {
  const manifest = await readJSON<PilotManifest>(PATHS.pilotManifest);
  const settings = await readJSON<ClaudeSettings>(PATHS.settingsFile);
  const managed = new Set(manifest?.managedHooks || []);

  // Find all wired hooks from settings
  const wired = new Set<string>();
  if (settings?.hooks) {
    for (const [, groups] of Object.entries(settings.hooks)) {
      if (!Array.isArray(groups)) continue;
      for (const group of groups) {
        if (!group.hooks) continue;
        for (const hook of group.hooks) {
          const match = hook.command.match(/\/([^/]+)\.sh$/);
          if (match) wired.add(match[1]);
        }
      }
    }
  }

  print("");
  print(chalk.bold("  Hooks"));
  print("");

  // Group by event
  const byEvent: Record<string, typeof HOOKS_MANIFEST> = {};
  for (const hook of HOOKS_MANIFEST) {
    if (!byEvent[hook.event]) byEvent[hook.event] = [];
    byEvent[hook.event].push(hook);
  }

  for (const [event, hooks] of Object.entries(byEvent)) {
    print(chalk.bold(`  ${event}:`));
    for (const hook of hooks) {
      const isActive = wired.has(hook.id);
      const isManaged = managed.has(hook.id);
      const status = isActive ? chalk.green("●") : chalk.dim("○");
      const badge = isManaged ? chalk.dim(" [pilot]") : "";
      const tier = hook.tier === "core" ? chalk.yellow(" core") : "";

      print(
        `    ${status} ${hook.id.padEnd(20)} ${chalk.dim(hook.description.slice(0, 50))}${tier}${badge}`
      );
    }
    print("");
  }
}

function infoHook(name: string): void {
  const hook = getHookById(name);
  if (!hook) {
    process.stderr.write(chalk.red(`  Hook not found: ${name}\n`));
    process.exitCode = 1;
    return;
  }

  print("");
  print(chalk.bold(`  ${hook.name} (${hook.id})`));
  print(`  ${hook.description}`);
  print(`  Event:     ${hook.event}`);
  if (hook.matcher) print(`  Matcher:   ${hook.matcher}`);
  print(`  Tier:      ${hook.tier}`);
  print(`  Category:  ${hook.category}`);
  print(`  Timeout:   ${hook.timeout}ms`);

  if (Object.keys(hook.requires).length > 0) {
    print("");
    print(chalk.bold("  Requires:"));
    const r = hook.requires;
    if (r.hasUI) print("    - Project has UI");
    if (r.hasAPI) print("    - Project has API");
    if (r.hasDocker) print("    - Project has Docker");
    if (r.runtime) print(`    - Runtime: ${r.runtime.join(" or ")}`);
    if (r.category) print(`    - Category: ${r.category.join(" or ")}`);
    if (r.hasDeps) print(`    - Dependencies: ${r.hasDeps.join(", ")}`);
  }
}
