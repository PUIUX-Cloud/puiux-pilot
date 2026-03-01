/**
 * Dependency Analyzer
 * Reads actual dependencies from package.json, Cargo.toml, pyproject.toml, etc.
 * Builds a complete DependencyProfile
 */

import { join } from "node:path";
import type { DependencyProfile } from "../../shared/types.js";
import { readJSON, readText, fileExists } from "../../shared/fs-utils.js";
import {
  DEP_TO_LINTER,
  DEP_TO_TEST,
  DEP_TO_DB,
  DEP_TO_CSS,
  DEP_TO_UI,
  DEP_TO_API,
  DEP_TO_I18N,
} from "../../shared/constants.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  packageManager?: string;
}

export async function analyzeDependencies(
  projectRoot: string,
  projectType: string
): Promise<DependencyProfile> {
  const profile: DependencyProfile = {
    packageManager: null,
    frameworks: [],
    linter: null,
    testFramework: null,
    database: null,
    cssFramework: null,
    uiFramework: null,
    apiFramework: null,
    i18n: null,
    dependencies: [],
    devDependencies: [],
  };

  // Detect package manager
  profile.packageManager = await detectPackageManager(projectRoot);

  // Analyze based on ecosystem
  const runtime = getRuntime(projectType);

  if (runtime === "node") {
    await analyzeNode(projectRoot, profile);
  } else if (runtime === "python") {
    await analyzePython(projectRoot, profile);
  } else if (runtime === "rust") {
    await analyzeRust(projectRoot, profile);
  } else if (runtime === "go") {
    await analyzeGo(projectRoot, profile);
  }

  return profile;
}

// ─── Package Manager Detection ───────────────────────────────────────────────

async function detectPackageManager(
  root: string
): Promise<DependencyProfile["packageManager"]> {
  // Check lockfiles first (most reliable)
  if (await fileExists(join(root, "bun.lockb"))) return "bun";
  if (await fileExists(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (await fileExists(join(root, "yarn.lock"))) return "yarn";
  if (await fileExists(join(root, "package-lock.json"))) return "npm";

  // Check package.json packageManager field
  const pkg = await readJSON<PackageJson>(join(root, "package.json"));
  if (pkg?.packageManager) {
    if (pkg.packageManager.startsWith("pnpm")) return "pnpm";
    if (pkg.packageManager.startsWith("yarn")) return "yarn";
    if (pkg.packageManager.startsWith("bun")) return "bun";
    return "npm";
  }

  // Python
  if (await fileExists(join(root, "Pipfile"))) return "pip";
  if (await fileExists(join(root, "pyproject.toml"))) return "pip";
  if (await fileExists(join(root, "requirements.txt"))) return "pip";

  // Rust
  if (await fileExists(join(root, "Cargo.toml"))) return "cargo";

  // Go
  if (await fileExists(join(root, "go.mod"))) return "go";

  // PHP
  if (await fileExists(join(root, "composer.json"))) return "composer";

  return null;
}

// ─── Node.js Analysis ────────────────────────────────────────────────────────

async function analyzeNode(
  root: string,
  profile: DependencyProfile
): Promise<void> {
  const pkg = await readJSON<PackageJson>(join(root, "package.json"));
  if (!pkg) return;

  const deps = pkg.dependencies || {};
  const devDeps = pkg.devDependencies || {};
  const allDeps = { ...deps, ...devDeps };

  profile.dependencies = Object.keys(deps);
  profile.devDependencies = Object.keys(devDeps);

  // Match dependencies against known maps
  profile.linter = matchFirst(allDeps, DEP_TO_LINTER);
  profile.testFramework = matchFirst(allDeps, DEP_TO_TEST);
  profile.database = matchFirst(allDeps, DEP_TO_DB);
  profile.cssFramework = matchFirst(allDeps, DEP_TO_CSS);
  profile.uiFramework = matchFirst(allDeps, DEP_TO_UI);
  profile.apiFramework = matchFirst(allDeps, DEP_TO_API);
  profile.i18n = matchFirst(allDeps, DEP_TO_I18N);

  // Also check config files for linter
  if (!profile.linter) {
    if (await fileExists(join(root, "biome.json"))) profile.linter = "biome";
    else if (await fileExists(join(root, "eslint.config.js"))) profile.linter = "eslint";
    else if (await fileExists(join(root, "eslint.config.mjs"))) profile.linter = "eslint";
    else if (await fileExists(join(root, ".eslintrc.json"))) profile.linter = "eslint";
    else if (await fileExists(join(root, ".eslintrc.js"))) profile.linter = "eslint";
  }

  // Collect frameworks
  const frameworkDeps = [
    ...Object.keys(deps).filter((d) => isFramework(d)),
    ...Object.keys(devDeps).filter((d) => isFramework(d)),
  ];
  profile.frameworks = [...new Set(frameworkDeps)];
}

// ─── Python Analysis ─────────────────────────────────────────────────────────

async function analyzePython(
  root: string,
  profile: DependencyProfile
): Promise<void> {
  // Try pyproject.toml first
  const pyproject = await readText(join(root, "pyproject.toml"));
  if (pyproject) {
    const deps = extractPyprojectDeps(pyproject);
    profile.dependencies = deps;

    // Check for known tools
    if (deps.includes("django")) profile.apiFramework = "django";
    else if (deps.includes("flask")) profile.apiFramework = "flask";
    else if (deps.includes("fastapi")) profile.apiFramework = "fastapi";

    if (deps.includes("pytest")) profile.testFramework = "pytest";
    if (deps.includes("ruff")) profile.linter = "ruff";
    else if (deps.includes("flake8")) profile.linter = "flake8";
    else if (deps.includes("pylint")) profile.linter = "pylint";

    if (deps.includes("sqlalchemy")) profile.database = "sqlalchemy";
    else if (deps.includes("django")) profile.database = "django-orm";

    profile.frameworks = deps.filter((d) =>
      ["django", "flask", "fastapi", "celery", "pydantic"].includes(d)
    );
    return;
  }

  // Fallback: requirements.txt
  const requirements = await readText(join(root, "requirements.txt"));
  if (requirements) {
    const deps = requirements
      .split("\n")
      .map((l) => l.trim().split(/[>=<!\[]/)[0].trim().toLowerCase())
      .filter(Boolean);
    profile.dependencies = deps;

    if (deps.includes("django")) profile.apiFramework = "django";
    else if (deps.includes("flask")) profile.apiFramework = "flask";
    else if (deps.includes("fastapi")) profile.apiFramework = "fastapi";

    if (deps.includes("pytest")) profile.testFramework = "pytest";
    profile.frameworks = deps.filter((d) =>
      ["django", "flask", "fastapi"].includes(d)
    );
  }
}

// ─── Rust Analysis ───────────────────────────────────────────────────────────

async function analyzeRust(
  root: string,
  profile: DependencyProfile
): Promise<void> {
  const cargoToml = await readText(join(root, "Cargo.toml"));
  if (!cargoToml) return;

  // Extract deps from [dependencies] section
  const depSection = cargoToml.match(
    /\[dependencies\]([\s\S]*?)(?:\[|$)/
  )?.[1];
  if (depSection) {
    const deps = depSection
      .split("\n")
      .map((l) => l.split("=")[0].trim())
      .filter((l) => l && !l.startsWith("#") && !l.startsWith("["));
    profile.dependencies = deps;

    if (deps.includes("actix-web") || deps.includes("axum") || deps.includes("rocket")) {
      profile.apiFramework = deps.includes("actix-web") ? "actix" : deps.includes("axum") ? "axum" : "rocket";
    }
    if (deps.includes("diesel") || deps.includes("sqlx")) {
      profile.database = deps.includes("diesel") ? "diesel" : "sqlx";
    }
    profile.frameworks = deps.filter((d) =>
      ["actix-web", "axum", "rocket", "tokio", "serde"].includes(d)
    );
  }

  profile.linter = "clippy"; // Rust always has clippy
  profile.testFramework = "cargo-test"; // Built-in
}

// ─── Go Analysis ─────────────────────────────────────────────────────────────

async function analyzeGo(
  root: string,
  profile: DependencyProfile
): Promise<void> {
  const goMod = await readText(join(root, "go.mod"));
  if (!goMod) return;

  const deps = goMod
    .split("\n")
    .filter((l) => l.startsWith("\t") && !l.includes("//"))
    .map((l) => l.trim().split(" ")[0])
    .filter(Boolean);

  profile.dependencies = deps;

  if (deps.some((d) => d.includes("gin-gonic"))) profile.apiFramework = "gin";
  else if (deps.some((d) => d.includes("labstack/echo"))) profile.apiFramework = "echo";
  else if (deps.some((d) => d.includes("gofiber"))) profile.apiFramework = "fiber";

  profile.testFramework = "go-test"; // Built-in
  profile.frameworks = deps.filter((d) =>
    d.includes("gin-gonic") || d.includes("labstack") || d.includes("gofiber")
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function matchFirst(
  deps: Record<string, string>,
  map: Record<string, string>
): string | null {
  for (const [dep, value] of Object.entries(map)) {
    if (dep in deps) return value;
  }
  return null;
}

function isFramework(dep: string): boolean {
  const frameworks = [
    "react",
    "react-dom",
    "vue",
    "svelte",
    "angular",
    "lit",
    "solid-js",
    "preact",
    "next",
    "nuxt",
    "astro",
    "gatsby",
    "express",
    "fastify",
    "hono",
    "koa",
    "prisma",
    "drizzle-orm",
    "tailwindcss",
    "electron",
  ];
  return frameworks.includes(dep);
}

function extractPyprojectDeps(content: string): string[] {
  // Extract from [project] dependencies = [...]
  const match = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
  if (!match) return [];

  return match[1]
    .split("\n")
    .map((l) => l.replace(/[",]/g, "").trim().split(/[>=<!\[]/)[0].trim().toLowerCase())
    .filter(Boolean);
}

function getRuntime(type: string): string {
  const nodeTypes = [
    "nextjs", "nuxt", "remix", "astro", "gatsby", "vite", "webpack",
    "react", "vue", "svelte", "angular", "lit", "solidjs", "qwik",
    "express", "fastify", "hono", "nestjs", "koa", "electron", "tauri",
    "react-native", "expo", "node", "deno", "bun",
  ];
  if (nodeTypes.includes(type)) return "node";
  if (["python", "django", "flask", "fastapi"].includes(type)) return "python";
  if (type === "rust") return "rust";
  if (type === "go") return "go";
  return "other";
}
