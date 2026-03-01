/**
 * Stack Profiler
 * Analyzes project structure to detect UI, API, tests, Docker, CI, etc.
 * Builds a StructureProfile from file system analysis
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { StructureProfile } from "../../shared/types.js";
import { fileExists } from "../../shared/fs-utils.js";

export async function profileStructure(
  projectRoot: string
): Promise<StructureProfile> {
  const profile: StructureProfile = {
    hasUI: false,
    hasAPI: false,
    hasTests: false,
    hasDocker: false,
    hasCI: false,
    hasDocs: false,
    sourceLanguages: [],
    configFiles: [],
  };

  // Run checks in parallel for speed
  const [ui, api, tests, docker, ci, docs, languages, configs] =
    await Promise.all([
      detectUI(projectRoot),
      detectAPI(projectRoot),
      detectTests(projectRoot),
      detectDocker(projectRoot),
      detectCI(projectRoot),
      detectDocs(projectRoot),
      detectLanguages(projectRoot),
      detectConfigFiles(projectRoot),
    ]);

  profile.hasUI = ui;
  profile.hasAPI = api;
  profile.hasTests = tests;
  profile.hasDocker = docker;
  profile.hasCI = ci;
  profile.hasDocs = docs;
  profile.sourceLanguages = languages;
  profile.configFiles = configs;

  return profile;
}

// ─── UI Detection ────────────────────────────────────────────────────────────

async function detectUI(root: string): Promise<boolean> {
  // Check for UI-specific directories
  const uiDirs = [
    "src/components",
    "src/views",
    "src/pages",
    "src/ui",
    "src/app",
    "components",
    "pages",
    "app",
    "public",
    "static",
  ];

  for (const dir of uiDirs) {
    if (await fileExists(join(root, dir))) return true;
  }

  // Check for UI-specific files
  const uiFiles = [
    "src/App.tsx",
    "src/App.jsx",
    "src/App.vue",
    "src/App.svelte",
    "src/main.tsx",
    "src/main.jsx",
    "index.html",
  ];

  for (const file of uiFiles) {
    if (await fileExists(join(root, file))) return true;
  }

  return false;
}

// ─── API Detection ───────────────────────────────────────────────────────────

async function detectAPI(root: string): Promise<boolean> {
  const apiDirs = [
    "src/api",
    "src/routes",
    "src/controllers",
    "src/endpoints",
    "src/handlers",
    "api",
    "routes",
    "controllers",
    "app/api",
  ];

  for (const dir of apiDirs) {
    if (await fileExists(join(root, dir))) return true;
  }

  // Check for API config files
  const apiFiles = [
    "src/server.ts",
    "src/server.js",
    "src/app.ts",
    "src/app.js",
    "server.ts",
    "server.js",
  ];

  for (const file of apiFiles) {
    if (await fileExists(join(root, file))) return true;
  }

  return false;
}

// ─── Test Detection ──────────────────────────────────────────────────────────

async function detectTests(root: string): Promise<boolean> {
  const testDirs = [
    "__tests__",
    "tests",
    "test",
    "spec",
    "e2e",
    "cypress",
    "src/__tests__",
    "src/tests",
  ];

  for (const dir of testDirs) {
    if (await fileExists(join(root, dir))) return true;
  }

  // Check for test config files
  const testConfigs = [
    "vitest.config.ts",
    "vitest.config.js",
    "jest.config.ts",
    "jest.config.js",
    "jest.config.json",
    "cypress.config.ts",
    "cypress.config.js",
    "playwright.config.ts",
    "playwright.config.js",
    "pytest.ini",
    "conftest.py",
  ];

  for (const file of testConfigs) {
    if (await fileExists(join(root, file))) return true;
  }

  return false;
}

// ─── Docker Detection ────────────────────────────────────────────────────────

async function detectDocker(root: string): Promise<boolean> {
  return (
    (await fileExists(join(root, "Dockerfile"))) ||
    (await fileExists(join(root, "docker-compose.yml"))) ||
    (await fileExists(join(root, "docker-compose.yaml"))) ||
    (await fileExists(join(root, ".dockerignore")))
  );
}

// ─── CI/CD Detection ─────────────────────────────────────────────────────────

async function detectCI(root: string): Promise<boolean> {
  return (
    (await fileExists(join(root, ".github/workflows"))) ||
    (await fileExists(join(root, ".gitlab-ci.yml"))) ||
    (await fileExists(join(root, ".circleci"))) ||
    (await fileExists(join(root, "Jenkinsfile"))) ||
    (await fileExists(join(root, ".travis.yml"))) ||
    (await fileExists(join(root, "bitbucket-pipelines.yml")))
  );
}

// ─── Docs Detection ──────────────────────────────────────────────────────────

async function detectDocs(root: string): Promise<boolean> {
  return (
    (await fileExists(join(root, "docs"))) ||
    (await fileExists(join(root, "documentation"))) ||
    (await fileExists(join(root, "CHANGELOG.md"))) ||
    (await fileExists(join(root, "CONTRIBUTING.md")))
  );
}

// ─── Language Detection ──────────────────────────────────────────────────────

async function detectLanguages(root: string): Promise<string[]> {
  const languages: Set<string> = new Set();

  // Check src/ directory for file extensions
  const srcDir = join(root, "src");
  if (await fileExists(srcDir)) {
    try {
      const entries = await readdir(srcDir);
      for (const entry of entries) {
        const ext = getExtension(entry);
        if (ext) languages.add(ext);
      }
    } catch {
      // ignore permission errors
    }
  }

  // Check root-level files
  try {
    const rootEntries = await readdir(root);
    for (const entry of rootEntries) {
      const ext = getExtension(entry);
      if (ext) languages.add(ext);
    }
  } catch {
    // ignore
  }

  return [...languages];
}

// ─── Config Files Detection ──────────────────────────────────────────────────

async function detectConfigFiles(root: string): Promise<string[]> {
  const configPatterns = [
    "tsconfig.json",
    "jsconfig.json",
    "biome.json",
    ".eslintrc.json",
    ".eslintrc.js",
    "eslint.config.js",
    "eslint.config.mjs",
    ".prettierrc",
    ".prettierrc.json",
    "tailwind.config.js",
    "tailwind.config.ts",
    "postcss.config.js",
    "postcss.config.mjs",
    ".env",
    ".env.local",
    ".env.development",
    ".gitignore",
    ".editorconfig",
    ".nvmrc",
    ".node-version",
    ".arch-rules.json",
    ".perf-budget.json",
  ];

  const found: string[] = [];
  for (const file of configPatterns) {
    if (await fileExists(join(root, file))) {
      found.push(file);
    }
  }
  return found;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getExtension(filename: string): string | null {
  const map: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".py": "python",
    ".rs": "rust",
    ".go": "go",
    ".java": "java",
    ".kt": "kotlin",
    ".swift": "swift",
    ".cs": "csharp",
    ".rb": "ruby",
    ".php": "php",
    ".css": "css",
    ".scss": "scss",
    ".html": "html",
    ".vue": "vue",
    ".svelte": "svelte",
  };

  for (const [ext, lang] of Object.entries(map)) {
    if (filename.endsWith(ext)) return lang;
  }
  return null;
}
