/**
 * Monorepo Detector
 * Detects monorepo tools and maps workspaces
 */

import { join } from "node:path";
import type { ProjectDNA } from "../../shared/types.js";
import { readJSON, readText, fileExists } from "../../shared/fs-utils.js";

export interface MonorepoInfo {
  tool: "turborepo" | "nx" | "lerna" | "pnpm-workspaces" | "yarn-workspaces" | "npm-workspaces";
  workspaces: WorkspaceInfo[];
}

export interface WorkspaceInfo {
  name: string;
  path: string;
  relativePath: string;
}

export async function detectMonorepo(
  projectRoot: string
): Promise<MonorepoInfo | null> {
  // Turborepo
  if (await fileExists(join(projectRoot, "turbo.json"))) {
    const workspaces = await resolveWorkspaces(projectRoot);
    return { tool: "turborepo", workspaces };
  }

  // Nx
  if (await fileExists(join(projectRoot, "nx.json"))) {
    const workspaces = await resolveWorkspaces(projectRoot);
    return { tool: "nx", workspaces };
  }

  // Lerna
  if (await fileExists(join(projectRoot, "lerna.json"))) {
    const workspaces = await resolveWorkspaces(projectRoot);
    return { tool: "lerna", workspaces };
  }

  // pnpm workspaces
  if (await fileExists(join(projectRoot, "pnpm-workspace.yaml"))) {
    const workspaces = await resolveWorkspaces(projectRoot);
    return { tool: "pnpm-workspaces", workspaces };
  }

  // npm/yarn workspaces (via package.json)
  const pkg = await readJSON<{ workspaces?: string[] | { packages: string[] } }>(
    join(projectRoot, "package.json")
  );
  if (pkg?.workspaces) {
    const workspaces = await resolveWorkspaces(projectRoot);
    const tool = (await fileExists(join(projectRoot, "yarn.lock")))
      ? "yarn-workspaces"
      : "npm-workspaces";
    return { tool, workspaces: workspaces };
  }

  return null;
}

async function resolveWorkspaces(root: string): Promise<WorkspaceInfo[]> {
  const workspaces: WorkspaceInfo[] = [];

  // Get workspace patterns from package.json
  const pkg = await readJSON<{ workspaces?: string[] | { packages: string[] } }>(
    join(root, "package.json")
  );

  let patterns: string[] = [];
  if (Array.isArray(pkg?.workspaces)) {
    patterns = pkg.workspaces;
  } else if (pkg?.workspaces?.packages) {
    patterns = pkg.workspaces.packages;
  }

  // Also check pnpm-workspace.yaml
  if (patterns.length === 0) {
    const pnpmYaml = await readText(join(root, "pnpm-workspace.yaml"));
    if (pnpmYaml) {
      const matches = pnpmYaml.match(/- ['"]?([^'"]+)['"]?/g);
      if (matches) {
        patterns = matches.map((m) => m.replace(/- ['"]?/, "").replace(/['"]?$/, ""));
      }
    }
  }

  // Resolve glob patterns to actual directories
  if (patterns.length > 0) {
    try {
      const fg = await import("fast-glob");
      const dirs = await fg.default(patterns, {
        cwd: root,
        onlyDirectories: true,
        absolute: false,
      });

      for (const dir of dirs) {
        const pkgPath = join(root, dir, "package.json");
        if (await fileExists(pkgPath)) {
          const wsPkg = await readJSON<{ name?: string }>(pkgPath);
          workspaces.push({
            name: wsPkg?.name || dir,
            path: join(root, dir),
            relativePath: dir,
          });
        }
      }
    } catch {
      // fast-glob might not be available during scan
    }
  }

  return workspaces;
}
