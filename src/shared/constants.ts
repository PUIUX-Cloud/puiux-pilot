import { join } from "node:path";
import { homedir } from "node:os";

export const VERSION = "0.1.0";

// ─── Paths ───────────────────────────────────────────────────────────────────

const HOME = homedir();

export const PATHS = {
  claudeDir: join(HOME, ".claude"),
  hooksDir: join(HOME, ".claude", "hooks"),
  skillsDir: join(HOME, ".claude", "skills"),
  settingsFile: join(HOME, ".claude", "settings.json"),
  projectsDir: join(HOME, ".claude", "projects"),
  pilotManifest: join(HOME, ".claude", ".puiux-pilot.json"),
  pilotDir: join(HOME, ".puiux-pilot"),
  metricsHistory: join(HOME, ".puiux-pilot", "metrics-history.jsonl"),
  secretsFile: join(HOME, ".claude", ".secrets"),
} as const;

// ─── Project Detection Markers ───────────────────────────────────────────────

/** Unique config files that identify a project type (TIER 1 detection) */
export const UNIQUE_MARKERS: Record<string, string> = {
  "next.config.js": "nextjs",
  "next.config.mjs": "nextjs",
  "next.config.ts": "nextjs",
  "nuxt.config.ts": "nuxt",
  "nuxt.config.js": "nuxt",
  "remix.config.js": "remix",
  "remix.config.ts": "remix",
  "astro.config.mjs": "astro",
  "astro.config.ts": "astro",
  "gatsby-config.js": "gatsby",
  "gatsby-config.ts": "gatsby",
  "svelte.config.js": "svelte",
  "angular.json": "angular",
  "vite.config.ts": "vite",
  "vite.config.js": "vite",
  "vite.config.mjs": "vite",
  "webpack.config.js": "webpack",
  "webpack.config.ts": "webpack",
  "rollup.config.js": "rollup",
  "rollup.config.mjs": "rollup",
  "turbo.json": "turbo",
  "nx.json": "turbo",
  "lerna.json": "turbo",
  "electron-builder.yml": "electron",
  "electron-builder.json": "electron",
  "tauri.conf.json": "tauri",
  "app.json": "expo",
  "metro.config.js": "react-native",
  "capacitor.config.ts": "capacitor",
  "ionic.config.json": "ionic",
  "pubspec.yaml": "flutter",
  "Cargo.toml": "rust",
  "go.mod": "go",
  "pom.xml": "java",
  "build.gradle": "java",
  "build.gradle.kts": "kotlin",
  "Package.swift": "swift",
  "Gemfile": "ruby",
  "composer.json": "php",
  "wp-config.php": "wordpress",
  "manage.py": "django",
  "main.tf": "terraform",
  "Pulumi.yaml": "pulumi",
  "playbook.yml": "ansible",
};

// ─── Runtime Mapping ─────────────────────────────────────────────────────────

export const TYPE_TO_RUNTIME: Record<string, string> = {
  nextjs: "node",
  nuxt: "node",
  remix: "node",
  astro: "node",
  gatsby: "node",
  vite: "node",
  webpack: "node",
  parcel: "node",
  rollup: "node",
  esbuild: "node",
  turbo: "node",
  react: "node",
  vue: "node",
  svelte: "node",
  angular: "node",
  lit: "node",
  solidjs: "node",
  qwik: "node",
  express: "node",
  fastify: "node",
  hono: "node",
  nestjs: "node",
  koa: "node",
  electron: "node",
  tauri: "node",
  "react-native": "node",
  expo: "node",
  capacitor: "node",
  ionic: "node",
  node: "node",
  deno: "node",
  bun: "node",
  python: "python",
  django: "python",
  flask: "python",
  fastapi: "python",
  rust: "rust",
  go: "go",
  java: "jvm",
  kotlin: "jvm",
  swift: "native",
  csharp: "dotnet",
  ruby: "node",
  rails: "node",
  php: "other",
  laravel: "other",
  wordpress: "other",
  flutter: "native",
  terraform: "other",
  kubernetes: "other",
  docker: "other",
  "docker-compose": "other",
  ansible: "other",
  pulumi: "other",
};

// ─── Category Mapping ────────────────────────────────────────────────────────

export const TYPE_TO_CATEGORY: Record<string, string> = {
  nextjs: "webapp",
  nuxt: "webapp",
  remix: "webapp",
  astro: "webapp",
  gatsby: "webapp",
  vite: "webapp",
  react: "webapp",
  vue: "webapp",
  svelte: "webapp",
  angular: "webapp",
  lit: "webapp",
  solidjs: "webapp",
  qwik: "webapp",
  express: "api",
  fastify: "api",
  hono: "api",
  nestjs: "api",
  koa: "api",
  django: "api",
  flask: "api",
  fastapi: "api",
  rails: "api",
  laravel: "api",
  electron: "desktop",
  tauri: "desktop",
  "react-native": "mobile",
  expo: "mobile",
  flutter: "mobile",
  capacitor: "mobile",
  ionic: "mobile",
  terraform: "infra",
  kubernetes: "infra",
  docker: "infra",
  "docker-compose": "infra",
  ansible: "infra",
  pulumi: "infra",
  turbo: "monorepo",
};

// ─── Dependency Detection Maps ───────────────────────────────────────────────

export const DEP_TO_LINTER: Record<string, string> = {
  eslint: "eslint",
  "@biomejs/biome": "biome",
  biome: "biome",
  prettier: "prettier",
  oxlint: "oxlint",
};

export const DEP_TO_TEST: Record<string, string> = {
  vitest: "vitest",
  jest: "jest",
  mocha: "mocha",
  ava: "ava",
  "@playwright/test": "playwright",
  cypress: "cypress",
  pytest: "pytest",
};

export const DEP_TO_DB: Record<string, string> = {
  prisma: "prisma",
  "@prisma/client": "prisma",
  drizzle: "drizzle",
  "drizzle-orm": "drizzle",
  typeorm: "typeorm",
  sequelize: "sequelize",
  mongoose: "mongoose",
  knex: "knex",
  "better-sqlite3": "sqlite",
  "sqlite-vec": "sqlite",
};

export const DEP_TO_CSS: Record<string, string> = {
  tailwindcss: "tailwind",
  "@tailwindcss/postcss": "tailwind",
  "@chakra-ui/react": "chakra",
  "@mui/material": "mui",
  "styled-components": "styled-components",
  "@emotion/react": "emotion",
  "sass": "sass",
};

export const DEP_TO_UI: Record<string, string> = {
  react: "react",
  "react-dom": "react",
  vue: "vue",
  svelte: "svelte",
  lit: "lit",
  "solid-js": "solid",
  "@angular/core": "angular",
  preact: "preact",
};

export const DEP_TO_API: Record<string, string> = {
  express: "express",
  fastify: "fastify",
  hono: "hono",
  "@nestjs/core": "nestjs",
  koa: "koa",
};

export const DEP_TO_I18N: Record<string, string> = {
  "i18next": "i18next",
  "next-intl": "next-intl",
  "vue-i18n": "vue-i18n",
  "react-intl": "react-intl",
};
