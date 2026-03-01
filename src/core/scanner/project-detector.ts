/**
 * Project Type Detector
 * Ported from detect-project.sh (1035 lines) → TypeScript
 * Supports 95+ project types via 4-tier detection
 */

import { access } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import { homedir } from "node:os";
import type { ProjectType, Runtime, ProjectCategory } from "../../shared/types.js";
import { UNIQUE_MARKERS, TYPE_TO_RUNTIME, TYPE_TO_CATEGORY } from "../../shared/constants.js";
import { fileExists, readJSON } from "../../shared/fs-utils.js";

interface DetectionResult {
  root: string;
  name: string;
  type: ProjectType;
  runtime: Runtime;
  category: ProjectCategory;
  monorepo: boolean;
}

/** Find the project root by walking up looking for common markers */
export async function findProjectRoot(startDir: string): Promise<string> {
  const markers = [
    "package.json",
    "Cargo.toml",
    "go.mod",
    "pyproject.toml",
    "pubspec.yaml",
    "pom.xml",
    "build.gradle",
    "Gemfile",
    "composer.json",
    ".git",
  ];

  let dir = startDir;
  const home = homedir();

  for (let i = 0; i < 15; i++) {
    for (const marker of markers) {
      if (await fileExists(join(dir, marker))) {
        return dir;
      }
    }
    const parent = dirname(dir);
    if (parent === dir || parent === home) break;
    dir = parent;
  }

  return startDir;
}

/** Detect project type, runtime, and category */
export async function detectProject(projectRoot: string): Promise<DetectionResult> {
  const name = basename(projectRoot);

  // TIER 1: Unique config files (highest confidence)
  const tier1 = await detectTier1(projectRoot);
  if (tier1) {
    return buildResult(projectRoot, name, tier1);
  }

  // TIER 2: Multi-file combos (Node+Python, monorepo)
  const tier2 = await detectTier2(projectRoot);
  if (tier2) {
    return buildResult(projectRoot, name, tier2);
  }

  // TIER 3: Build tool / config inference
  const tier3 = await detectTier3(projectRoot);
  if (tier3) {
    return buildResult(projectRoot, name, tier3);
  }

  // TIER 4: Generic fallbacks
  const tier4 = await detectTier4(projectRoot);
  return buildResult(projectRoot, name, tier4 || "other");
}

// ─── Tier 1: Unique Config Files ─────────────────────────────────────────────

async function detectTier1(root: string): Promise<ProjectType | null> {
  for (const [file, type] of Object.entries(UNIQUE_MARKERS)) {
    if (await fileExists(join(root, file))) {
      return type as ProjectType;
    }
  }
  return null;
}

// ─── Tier 2: Multi-File Combos ───────────────────────────────────────────────

async function detectTier2(root: string): Promise<ProjectType | null> {
  const hasPackageJson = await fileExists(join(root, "package.json"));
  const hasPyproject = await fileExists(join(root, "pyproject.toml"));
  const hasRequirements = await fileExists(join(root, "requirements.txt"));
  const hasPipfile = await fileExists(join(root, "Pipfile"));
  const hasPython = hasPyproject || hasRequirements || hasPipfile;

  // Node + Python combo: check which is primary
  if (hasPackageJson && hasPython) {
    const pkg = await readJSON<{ dependencies?: Record<string, string> }>(
      join(root, "package.json")
    );
    const depCount = pkg?.dependencies ? Object.keys(pkg.dependencies).length : 0;
    return depCount > 0 ? "node" : "python";
  }

  // Monorepo detection
  const monorepoMarkers = ["turbo.json", "nx.json", "lerna.json"];
  for (const marker of monorepoMarkers) {
    if (await fileExists(join(root, marker))) {
      return "turbo";
    }
  }

  // pnpm workspaces
  if (hasPackageJson && await fileExists(join(root, "pnpm-workspace.yaml"))) {
    return "turbo";
  }

  return null;
}

// ─── Tier 3: Build Tool Inference ────────────────────────────────────────────

async function detectTier3(root: string): Promise<ProjectType | null> {
  // Python-specific
  if (await fileExists(join(root, "pyproject.toml"))) return "python";
  if (await fileExists(join(root, "requirements.txt"))) return "python";
  if (await fileExists(join(root, "Pipfile"))) return "python";
  if (await fileExists(join(root, "setup.py"))) return "python";

  // Check package.json for framework-specific deps
  if (await fileExists(join(root, "package.json"))) {
    const pkg = await readJSON<{
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    }>(join(root, "package.json"));

    if (pkg) {
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      // Framework detection from deps (ordered by specificity)
      if ("next" in allDeps) return "nextjs";
      if ("nuxt" in allDeps) return "nuxt";
      if ("@remix-run/node" in allDeps || "@remix-run/react" in allDeps) return "remix";
      if ("astro" in allDeps) return "astro";
      if ("gatsby" in allDeps) return "gatsby";
      if ("@nestjs/core" in allDeps) return "nestjs";
      if ("@angular/core" in allDeps) return "angular";
      if ("svelte" in allDeps) return "svelte";
      if ("vue" in allDeps) return "vue";
      if ("solid-js" in allDeps) return "solidjs";
      if ("lit" in allDeps) return "lit";
      if ("@builder.io/qwik" in allDeps) return "qwik";
      if ("electron" in allDeps) return "electron";
      if ("@tauri-apps/api" in allDeps) return "tauri";
      if ("react-native" in allDeps) return "react-native";
      if ("expo" in allDeps) return "expo";
      if ("@capacitor/core" in allDeps) return "capacitor";
      if ("@ionic/react" in allDeps || "@ionic/angular" in allDeps) return "ionic";
      if ("fastify" in allDeps) return "fastify";
      if ("hono" in allDeps) return "hono";
      if ("koa" in allDeps) return "koa";
      if ("express" in allDeps) return "express";
      if ("react" in allDeps || "react-dom" in allDeps) return "react";
    }

    return "node";
  }

  return null;
}

// ─── Tier 4: Generic Fallbacks ───────────────────────────────────────────────

async function detectTier4(root: string): Promise<ProjectType | null> {
  // Infrastructure (low priority — languages always win)
  if (await fileExists(join(root, "k8s")) || await fileExists(join(root, "kubernetes"))) {
    return "kubernetes";
  }
  if (await fileExists(join(root, "Dockerfile"))) return "docker";
  if (
    (await fileExists(join(root, "docker-compose.yml"))) ||
    (await fileExists(join(root, "docker-compose.yaml")))
  ) {
    return "docker-compose";
  }

  // .NET
  const csprojExists = await hasFileWithExtension(root, ".csproj");
  if (csprojExists) return "csharp";

  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildResult(
  root: string,
  name: string,
  type: ProjectType
): DetectionResult {
  const runtime = (TYPE_TO_RUNTIME[type] || "other") as Runtime;
  const category = (TYPE_TO_CATEGORY[type] || "other") as ProjectCategory;

  const monorepoTypes = ["turbo"];
  const monorepo = monorepoTypes.includes(type);

  return { root, name, type, runtime, category, monorepo };
}

async function hasFileWithExtension(dir: string, ext: string): Promise<boolean> {
  try {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(dir);
    return entries.some((e) => e.endsWith(ext));
  } catch {
    return false;
  }
}
