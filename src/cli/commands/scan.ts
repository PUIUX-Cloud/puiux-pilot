/**
 * puiux-pilot scan [path]
 * Analyze project without changing anything. Shows Project DNA.
 * READ-ONLY: never mutates files.
 */

import chalk from "chalk";
import ora from "ora";
import { resolve } from "node:path";
import { scanProject } from "../../core/scanner/index.js";
import { print } from "../../shared/logger.js";

interface ScanOptions {
  json?: boolean;
}

export async function scanCommand(
  path: string | undefined,
  options: ScanOptions
): Promise<void> {
  const targetDir = path ? resolve(path) : process.cwd();
  const spinner = ora("Scanning project...").start();

  try {
    const dna = await scanProject(targetDir);
    spinner.stop();

    if (options.json) {
      print(JSON.stringify(dna, null, 2));
      return;
    }

    print("");
    print(chalk.bold(`  Project: ${dna.identity.name}`));
    print(`  Type:      ${dna.identity.type}`);
    print(`  Runtime:   ${dna.identity.runtime}`);
    print(`  Category:  ${dna.identity.category}`);
    print(`  Monorepo:  ${dna.identity.monorepo ? "yes" : "no"}`);
    print(`  Root:      ${dna.identity.root}`);
    print("");

    print(chalk.bold("  Dependencies:"));
    print(`  Package Manager: ${dna.dependencies.packageManager || "—"}`);
    print(`  Linter:          ${dna.dependencies.linter || "—"}`);
    print(`  Test Framework:  ${dna.dependencies.testFramework || "—"}`);
    print(`  Database:        ${dna.dependencies.database || "—"}`);
    print(`  CSS Framework:   ${dna.dependencies.cssFramework || "—"}`);
    print(`  UI Framework:    ${dna.dependencies.uiFramework || "—"}`);
    print(`  API Framework:   ${dna.dependencies.apiFramework || "—"}`);

    if (dna.dependencies.frameworks.length > 0) {
      print(`  Frameworks:      ${dna.dependencies.frameworks.join(", ")}`);
    }
    print("");

    print(chalk.bold("  Structure:"));
    print(`  Has UI:      ${yn(dna.structure.hasUI)}`);
    print(`  Has API:     ${yn(dna.structure.hasAPI)}`);
    print(`  Has Tests:   ${yn(dna.structure.hasTests)}`);
    print(`  Has Docker:  ${yn(dna.structure.hasDocker)}`);
    print(`  Has CI:      ${yn(dna.structure.hasCI)}`);
    print(`  Has Docs:    ${yn(dna.structure.hasDocs)}`);

    if (dna.structure.sourceLanguages.length > 0) {
      print(`  Languages:   ${dna.structure.sourceLanguages.join(", ")}`);
    }

    print(`  Scan time:   ${dna.scanDurationMs}ms`);
  } catch (err) {
    spinner.fail("Scan failed");
    process.stderr.write(chalk.red(String(err)) + "\n");
    process.exitCode = 1;
  }
}

function yn(v: boolean): string {
  return v ? chalk.green("yes") : chalk.dim("no");
}
