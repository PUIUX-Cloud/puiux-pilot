/**
 * Hook Selector
 * Selects relevant hooks based on Project DNA
 * The intelligence that makes PUIUX Pilot adaptive
 */

import type { ProjectDNA, HookMetadata, HookProfile } from "../../shared/types.js";
import { HOOKS_MANIFEST, getCoreHooks } from "../../registry/hooks-manifest.js";
import { PROFILES } from "../../registry/profiles/index.js";

interface SelectionResult {
  selected: HookMetadata[];
  skipped: { hook: string; reason: string }[];
  profile: string;
}

/**
 * Select hooks based on Project DNA and optional profile override
 */
export function selectHooks(
  dna: ProjectDNA,
  profileName?: string
): SelectionResult {
  const selected: HookMetadata[] = [];
  const skipped: { hook: string; reason: string }[] = [];

  // Determine profile
  const resolvedProfile = profileName || autoSelectProfile(dna);
  const profile = PROFILES[resolvedProfile] || PROFILES["full-stack"];

  for (const hook of HOOKS_MANIFEST) {
    // Core hooks are always included
    if (hook.tier === "core") {
      selected.push(hook);
      continue;
    }

    // Check profile overrides first
    if (profile.hooks.disable.includes(hook.id) ||
        (profile.hooks.disable.includes("*") && !profile.hooks.enable.includes(hook.id))) {
      skipped.push({ hook: hook.id, reason: `Disabled by profile: ${resolvedProfile}` });
      continue;
    }

    // Force-enabled by profile
    if (profile.hooks.enable.includes(hook.id) || profile.hooks.enable.includes("*")) {
      selected.push(hook);
      continue;
    }

    // Check relevance based on DNA
    const relevance = checkRelevance(hook, dna);
    if (relevance.relevant) {
      selected.push(hook);
    } else {
      skipped.push({ hook: hook.id, reason: relevance.reason });
    }
  }

  return { selected, skipped, profile: resolvedProfile };
}

/**
 * Auto-select profile based on project DNA
 */
export function autoSelectProfile(dna: ProjectDNA): string {
  const { category } = dna.identity;
  const { hasUI, hasAPI } = dna.structure;

  if (category === "library") return "library";
  if (category === "infra") return "infra";
  if (category === "mobile") return "mobile";
  if (category === "cli") return "api-only";
  if (hasUI && hasAPI) return "full-stack";
  if (hasAPI && !hasUI) return "api-only";
  return "full-stack";
}

/**
 * Check if a hook is relevant for a given project DNA
 */
function checkRelevance(
  hook: HookMetadata,
  dna: ProjectDNA
): { relevant: boolean; reason: string } {
  const { requires } = hook;

  // Category check
  if (requires.category && !requires.category.includes(dna.identity.category)) {
    return {
      relevant: false,
      reason: `Category mismatch: needs ${requires.category.join("|")}, project is ${dna.identity.category}`,
    };
  }

  // Runtime check
  if (requires.runtime && !requires.runtime.includes(dna.identity.runtime)) {
    return {
      relevant: false,
      reason: `Runtime mismatch: needs ${requires.runtime.join("|")}, project is ${dna.identity.runtime}`,
    };
  }

  // UI check
  if (requires.hasUI && !dna.structure.hasUI) {
    return {
      relevant: false,
      reason: "Requires UI but project has no frontend",
    };
  }

  // API check
  if (requires.hasAPI && !dna.structure.hasAPI) {
    return {
      relevant: false,
      reason: "Requires API but project has no backend",
    };
  }

  // Docker check
  if (requires.hasDocker && !dna.structure.hasDocker) {
    return {
      relevant: false,
      reason: "Requires Docker but project has no Docker setup",
    };
  }

  // Dependencies check
  if (requires.hasDeps) {
    const allDeps = [
      ...dna.dependencies.dependencies,
      ...dna.dependencies.devDependencies,
    ];
    for (const dep of requires.hasDeps) {
      if (!allDeps.includes(dep)) {
        return {
          relevant: false,
          reason: `Missing required dependency: ${dep}`,
        };
      }
    }
  }

  return { relevant: true, reason: "" };
}

/**
 * Get a human-readable summary of hook selection
 */
export function summarizeSelection(result: SelectionResult): string {
  const byEvent: Record<string, number> = {};
  for (const hook of result.selected) {
    byEvent[hook.event] = (byEvent[hook.event] || 0) + 1;
  }

  const parts = Object.entries(byEvent).map(
    ([event, count]) => `${count} ${event}`
  );

  return `${result.selected.length} hooks selected (${parts.join(", ")}) | Profile: ${result.profile} | ${result.skipped.length} skipped`;
}
