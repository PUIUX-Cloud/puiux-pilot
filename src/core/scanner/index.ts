/**
 * Scanner Orchestrator
 * Combines project detection, dependency analysis, and structure profiling
 * into a complete ProjectDNA
 */

import type { ProjectDNA } from "../../shared/types.js";
import { findProjectRoot, detectProject } from "./project-detector.js";
import { analyzeDependencies } from "./dep-analyzer.js";
import { profileStructure } from "./stack-profiler.js";

export { findProjectRoot, detectProject } from "./project-detector.js";
export { analyzeDependencies } from "./dep-analyzer.js";
export { profileStructure } from "./stack-profiler.js";

/**
 * Full project scan: detect → analyze deps → profile structure → build DNA
 * This is a pure function with no side effects.
 */
export async function scanProject(startDir: string): Promise<ProjectDNA> {
  const startTime = performance.now();

  // Phase 1: Find project root
  const projectRoot = await findProjectRoot(startDir);

  // Phase 2: Detect project type (fast, file existence checks)
  const detection = await detectProject(projectRoot);

  // Phase 3+4: Run dependency analysis and structure profiling in parallel
  const [dependencies, structure] = await Promise.all([
    analyzeDependencies(projectRoot, detection.type),
    profileStructure(projectRoot),
  ]);

  // Refine category based on structure (override type-based default)
  let category = detection.category;
  if (structure.hasUI && structure.hasAPI && category !== "monorepo") {
    category = "webapp";
  } else if (structure.hasAPI && !structure.hasUI && category === "webapp") {
    category = "api";
  }

  // Refine hasUI based on dependencies
  if (dependencies.uiFramework && !structure.hasUI) {
    structure.hasUI = true;
  }

  const scanDuration = Math.round(performance.now() - startTime);

  const dna: ProjectDNA = {
    version: 1,
    identity: {
      root: detection.root,
      name: detection.name,
      type: detection.type,
      runtime: detection.runtime,
      category,
      monorepo: detection.monorepo,
    },
    dependencies,
    structure,
    quality: null, // Computed separately by scorer
    hookProfile: [], // Computed by hook-selector
    recommendations: [], // Computed by scorer
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scanDurationMs: scanDuration,
  };

  return dna;
}

/** Quick scan: only type detection, no dependency analysis */
export async function quickScan(
  startDir: string
): Promise<{ root: string; type: string; runtime: string; category: string }> {
  const projectRoot = await findProjectRoot(startDir);
  const detection = await detectProject(projectRoot);
  return {
    root: detection.root,
    type: detection.type,
    runtime: detection.runtime,
    category: detection.category,
  };
}
