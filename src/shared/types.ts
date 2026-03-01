// ─── Project Types ───────────────────────────────────────────────────────────

export type ProjectType =
  | "nextjs"
  | "nuxt"
  | "remix"
  | "astro"
  | "gatsby"
  | "vite"
  | "webpack"
  | "parcel"
  | "rollup"
  | "esbuild"
  | "turbo"
  | "react"
  | "vue"
  | "svelte"
  | "angular"
  | "lit"
  | "solidjs"
  | "qwik"
  | "express"
  | "fastify"
  | "hono"
  | "nestjs"
  | "koa"
  | "electron"
  | "tauri"
  | "react-native"
  | "expo"
  | "flutter"
  | "capacitor"
  | "ionic"
  | "node"
  | "deno"
  | "bun"
  | "python"
  | "django"
  | "flask"
  | "fastapi"
  | "rust"
  | "go"
  | "java"
  | "kotlin"
  | "swift"
  | "csharp"
  | "ruby"
  | "rails"
  | "php"
  | "laravel"
  | "wordpress"
  | "terraform"
  | "kubernetes"
  | "docker"
  | "docker-compose"
  | "ansible"
  | "pulumi"
  | "other";

export type Runtime =
  | "node"
  | "python"
  | "go"
  | "rust"
  | "jvm"
  | "dotnet"
  | "native"
  | "other";

export type ProjectCategory =
  | "webapp"
  | "api"
  | "library"
  | "cli"
  | "mobile"
  | "desktop"
  | "infra"
  | "monorepo"
  | "other";

// ─── Project DNA ─────────────────────────────────────────────────────────────

export interface ProjectDNA {
  version: 1;
  identity: ProjectIdentity;
  dependencies: DependencyProfile;
  structure: StructureProfile;
  quality: QualityBaseline | null;
  hookProfile: string[];
  recommendations: string[];
  createdAt: string;
  updatedAt: string;
  scanDurationMs: number;
}

export interface ProjectIdentity {
  root: string;
  name: string;
  type: ProjectType;
  runtime: Runtime;
  category: ProjectCategory;
  monorepo: boolean;
}

export interface DependencyProfile {
  packageManager:
    | "npm"
    | "pnpm"
    | "yarn"
    | "bun"
    | "pip"
    | "cargo"
    | "go"
    | "composer"
    | null;
  frameworks: string[];
  linter: string | null;
  testFramework: string | null;
  database: string | null;
  cssFramework: string | null;
  uiFramework: string | null;
  apiFramework: string | null;
  i18n: string | null;
  dependencies: string[];
  devDependencies: string[];
}

export interface StructureProfile {
  hasUI: boolean;
  hasAPI: boolean;
  hasTests: boolean;
  hasDocker: boolean;
  hasCI: boolean;
  hasDocs: boolean;
  sourceLanguages: string[];
  configFiles: string[];
}

export interface QualityBaseline {
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
  dimensions: {
    security: number;
    codeQuality: number;
    architecture: number;
    testing: number;
    design: number;
    workflow: number;
  };
  issues: QualityIssue[];
  analyzedAt: string;
}

export interface QualityIssue {
  dimension: keyof QualityBaseline["dimensions"];
  severity: "error" | "warning" | "info";
  message: string;
  deduction: number;
  file?: string;
  fixable: boolean;
}

// ─── Hook System ─────────────────────────────────────────────────────────────

export type HookEvent =
  | "PreToolUse"
  | "PostToolUse"
  | "Stop"
  | "SessionStart"
  | "PreCompact"
  | "UserPromptSubmit";

export interface HookMetadata {
  id: string;
  name: string;
  description: string;
  event: HookEvent;
  matcher?: string;
  script: string;
  category: "security" | "quality" | "design" | "performance" | "workflow";
  tier: "core" | "recommended" | "optional";
  requires: HookRequirements;
  timeout: number;
  parallelGroup?: string;
  dependsOn?: string[];
}

export interface HookRequirements {
  hasUI?: boolean;
  hasAPI?: boolean;
  hasDocker?: boolean;
  runtime?: Runtime[];
  category?: ProjectCategory[];
  hasDeps?: string[];
  hasFiles?: string[];
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export interface HookProfile {
  name: string;
  description: string;
  extends?: string;
  hooks: {
    enable: string[];
    disable: string[];
  };
}

// ─── Translation ─────────────────────────────────────────────────────────────

export type ToolFormat =
  | "claude"
  | "cursor"
  | "cline"
  | "windsurf"
  | "copilot"
  | "aider";

export interface TranslationIR {
  meta: {
    source: ToolFormat;
    sourceFile: string;
    generatedAt: string;
  };
  sections: IRSection[];
}

export interface IRSection {
  id: string;
  title: string;
  category:
    | "coding-style"
    | "architecture"
    | "testing"
    | "workflow"
    | "security"
    | "tooling"
    | "conventions"
    | "project-context";
  rules: IRRule[];
  glob?: string;
}

export interface IRRule {
  id: string;
  content: string;
  priority: "must" | "should" | "may";
  toolSpecific?: {
    tool: ToolFormat;
    capability: string;
  };
}

// ─── Team ────────────────────────────────────────────────────────────────────

export interface TeamConfig {
  version: string;
  team: {
    name: string;
    created: string;
  };
  enforce: {
    qualityThreshold: string;
    hooks: {
      required: string[];
      recommended: string[];
      blocked: string[];
    };
    skills: {
      required: string[];
    };
  };
  roles: Record<string, RoleConfig>;
}

export interface RoleConfig {
  additionalHooks: string[];
  additionalSkills: string[];
  overrides?: Record<string, unknown>;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface ClaudeSettings {
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  hooks?: Record<string, ClaudeHookGroup[]>;
  mcpServers?: Record<string, MCPServerConfig>;
}

export interface ClaudeHookGroup {
  matcher?: string;
  hooks: ClaudeHookEntry[];
}

export interface ClaudeHookEntry {
  type: "command";
  command: string;
  timeout: number;
}

export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// ─── Change Plan (Dry-Run Report) ───────────────────────────────────────────

export interface ChangePlan {
  backupsToCreate: string[];
  filesToWrite: Array<{ path: string; action: "create" | "modify" }>;
  diffsSummary: string[];
  warnings: string[];
  rollbackAvailable: boolean;
  hooks: Array<{ id: string; event: string; tier: string }>;
  mcps: Array<{ name: string; reason: string }>;
  profile: string;
  dna: ProjectDNA;
}

export interface ApplyResult {
  backupDir: string | null;
  backupsCreated: string[];
  filesWritten: string[];
  verification: Array<{ check: string; passed: boolean; detail: string }>;
  rollbackPerformed: boolean;
  errors: string[];
  exitCode: number;
}

// ─── Tracking Manifest ───────────────────────────────────────────────────────

export interface PilotManifest {
  version: string;
  installedAt: string;
  lastScan: string;
  profile: string;
  managedHooks: string[];
  managedSkills: string[];
  managedMCPs: string[];
  hookHashes: Record<string, string>;
  projectDNA: ProjectDNA | null;
}
