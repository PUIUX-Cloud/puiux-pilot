/**
 * puiux-pilot score [path]
 * Run quality assessment. READ-ONLY: never mutates files.
 */

import chalk from "chalk";
import ora from "ora";
import { resolve } from "node:path";
import { scanProject } from "../../core/scanner/index.js";
import { calculateScore, formatScoreReport } from "../../core/scorer/calculator.js";
import { print } from "../../shared/logger.js";

interface ScoreOptions {
  json?: boolean;
}

export async function scoreCommand(
  path: string | undefined,
  options: ScoreOptions
): Promise<void> {
  const targetDir = path ? resolve(path) : process.cwd();
  const spinner = ora("Analyzing project quality...").start();

  try {
    const dna = await scanProject(targetDir);
    const score = await calculateScore(dna);
    spinner.stop();

    if (options.json) {
      print(JSON.stringify(score, null, 2));
      return;
    }

    print(formatScoreReport(score));
  } catch (err) {
    spinner.fail("Quality assessment failed");
    process.stderr.write(chalk.red(String(err)) + "\n");
    process.exitCode = 1;
  }
}
