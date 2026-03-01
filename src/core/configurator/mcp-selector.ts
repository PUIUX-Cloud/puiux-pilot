/**
 * MCP Selector
 * Selects MCP servers based on actual project dependencies
 * Ported from detect-project.sh adaptive intelligence layer
 */

import type { ProjectDNA, MCPServerConfig } from "../../shared/types.js";

interface MCPSelection {
  servers: Record<string, MCPServerConfig>;
  reasons: Record<string, string>;
}

/**
 * Select MCPs based on project DNA
 */
export function selectMCPs(dna: ProjectDNA): MCPSelection {
  const servers: Record<string, MCPServerConfig> = {};
  const reasons: Record<string, string> = {};

  const allDeps = [
    ...dna.dependencies.dependencies,
    ...dna.dependencies.devDependencies,
  ];

  // ESLint MCP — if eslint is installed
  if (dna.dependencies.linter === "eslint" || allDeps.includes("eslint")) {
    servers["eslint"] = {
      command: "npx",
      args: ["-y", "eslint-mcp"],
    };
    reasons["eslint"] = "ESLint detected in dependencies";
  }

  // Icons — if UI framework detected
  if (dna.structure.hasUI) {
    servers["icons8"] = {
      command: "npx",
      args: ["-y", "@anthropic-ai/icons8-mcp"],
    };
    reasons["icons8"] = "UI framework detected — icons available";
  }

  // Lottie animations — if UI framework with animations likely
  if (dna.structure.hasUI && dna.dependencies.cssFramework) {
    servers["lottiefiles"] = {
      command: "npx",
      args: ["-y", "@anthropic-ai/lottiefiles-mcp"],
    };
    reasons["lottiefiles"] = "UI + CSS framework detected — animations available";
  }

  // Database MCP — if ORM/DB detected
  if (dna.dependencies.database === "prisma") {
    servers["prisma"] = {
      command: "npx",
      args: ["-y", "prisma-mcp"],
    };
    reasons["prisma"] = "Prisma ORM detected in dependencies";
  }

  // Tailwind MCP — if Tailwind detected
  if (dna.dependencies.cssFramework === "tailwind") {
    servers["tailwindcss"] = {
      command: "npx",
      args: ["-y", "@anthropic-ai/tailwindcss-mcp"],
    };
    reasons["tailwindcss"] = "Tailwind CSS detected in dependencies";
  }

  return { servers, reasons };
}
