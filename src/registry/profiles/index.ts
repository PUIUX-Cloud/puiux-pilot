/**
 * Pre-built Hook Profiles
 * Each profile defines which hooks to enable/disable for specific project types
 */

import type { HookProfile } from "../../shared/types.js";

export const PROFILES: Record<string, HookProfile> = {
  "full-stack": {
    name: "Full Stack",
    description: "All hooks enabled. For production web apps with UI + API.",
    hooks: {
      enable: ["*"],
      disable: [],
    },
  },

  "security-first": {
    name: "Security First",
    description: "Maximum security hooks. For fintech, health, gov projects.",
    hooks: {
      enable: ["*"],
      disable: [],
    },
  },

  "api-only": {
    name: "API Only",
    description: "Backend/API projects. No UI hooks.",
    hooks: {
      enable: [
        "guard-files", "secret-scanner", "guard-commands", "commit-lint",
        "detect-project", "arch-guard", "dep-health", "anti-mock",
        "dora-tracker", "qa-review", "dead-code", "dep-audit",
        "doc-freshness", "session-end", "session-start", "pre-compact",
        "prompt-context",
      ],
      disable: [
        "qa-design", "qa-a11y", "visual-check", "seo-check",
        "perf-budget", "csp-sri-check",
      ],
    },
  },

  library: {
    name: "Library",
    description: "npm/pip/crate packages. Focus on API surface, types, docs.",
    hooks: {
      enable: [
        "guard-files", "secret-scanner", "guard-commands", "commit-lint",
        "detect-project", "arch-guard", "dep-health", "dead-code",
        "doc-freshness", "dep-audit", "session-end", "session-start",
        "pre-compact", "prompt-context",
      ],
      disable: [
        "auto-sync", "self-heal", "perf-budget", "build-tracker",
        "qa-design", "qa-a11y", "visual-check", "seo-check",
        "csp-sri-check", "anti-mock", "stop-review",
      ],
    },
  },

  "startup-speed": {
    name: "Startup Speed",
    description: "Minimal hooks for fast iteration. Security only.",
    hooks: {
      enable: [
        "guard-files", "secret-scanner", "guard-commands",
        "detect-project", "session-end",
      ],
      disable: ["*"],
    },
  },

  mobile: {
    name: "Mobile App",
    description: "React Native / Flutter / Swift / Kotlin projects.",
    hooks: {
      enable: [
        "guard-files", "secret-scanner", "guard-commands", "commit-lint",
        "detect-project", "arch-guard", "dep-health", "anti-mock",
        "qa-review", "qa-a11y", "dead-code", "dep-audit",
        "doc-freshness", "session-end", "session-start", "pre-compact",
        "prompt-context",
      ],
      disable: [
        "auto-sync", "self-heal", "perf-budget", "build-tracker",
        "qa-design", "visual-check", "seo-check", "csp-sri-check",
        "stop-review",
      ],
    },
  },

  infra: {
    name: "Infrastructure",
    description: "Terraform, Kubernetes, Ansible, Docker projects.",
    hooks: {
      enable: [
        "guard-files", "secret-scanner", "guard-commands",
        "detect-project", "doc-freshness", "session-end",
        "session-start", "pre-compact", "prompt-context",
      ],
      disable: ["*"],
    },
  },
};

/** List all available profile names */
export function listProfiles(): string[] {
  return Object.keys(PROFILES);
}

/** Get profile description */
export function describeProfile(name: string): string {
  const p = PROFILES[name];
  return p ? `${p.name}: ${p.description}` : `Unknown profile: ${name}`;
}
