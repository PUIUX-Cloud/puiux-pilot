#!/usr/bin/env node

/**
 * PUIUX Pilot CLI
 * One command to rule them all: scan, configure, and optimize any project for Claude Code
 */

import { Command } from "commander";
import { homedir } from "node:os";
import { join } from "node:path";
import { VERSION } from "../shared/constants.js";
import { initCommand } from "./commands/init.js";
import { scanCommand } from "./commands/scan.js";
import { scoreCommand } from "./commands/score.js";
import { doctorCommand } from "./commands/doctor.js";
import { hooksCommand } from "./commands/hooks.js";
import { ejectCommand } from "./commands/eject.js";
import { translateCommand } from "./commands/translate.js";

// DEBUG=1 self-check: show resolved paths to confirm sandbox isolation
if (process.env.DEBUG === "1") {
  const home = homedir();
  process.stderr.write(
    `[pilot-debug] HOME=${home}\n` +
    `[pilot-debug] claude_dir=${join(home, ".claude")}\n` +
    `[pilot-debug] pilot_dir=${join(home, ".puiux-pilot")}\n`
  );
}

const program = new Command();

program
  .name("puiux-pilot")
  .description(
    "Adaptive AI coding assistant configurator for Claude Code.\n" +
      "Scans your project, selects the right hooks/MCPs/skills, and configures everything automatically."
  )
  .version(VERSION, "-v, --version");

// ─── Commands ────────────────────────────────────────────────────────────────

program
  .command("init")
  .description("Scan project and plan changes (dry-run by default, --apply to write)")
  .option("-p, --profile <name>", "Use a pre-built profile")
  .option("--minimal", "Install only essential security hooks")
  .option("--full", "Install everything")
  .option("--apply", "Actually write changes (default is dry-run)")
  .option("--force", "Overwrite user-modified hooks")
  .option("--no-mcps", "Skip MCP auto-detection")
  .option("--no-skills", "Skip skill installation")
  .action(initCommand);

program
  .command("scan [path]")
  .description("Analyze project without changing anything")
  .option("--json", "Output as JSON")
  .action(scanCommand);

program
  .command("score [path]")
  .description("Run quality assessment (6 dimensions, 0-100, A-F grade)")
  .option("--json", "Output as JSON")
  .action(scoreCommand);

program
  .command("doctor")
  .description("Health check for your Claude Code setup")
  .option("--fix", "Auto-fix issues where possible")
  .action(doctorCommand);

program
  .command("hooks")
  .description("Manage hooks")
  .argument("[action]", "list, enable, disable, info", "list")
  .argument("[name]", "Hook name")
  .action(hooksCommand);

program
  .command("translate")
  .description("[EXPERIMENTAL] Translate config between AI coding tools")
  .option("--from <tool>", "Source tool (claude, cursor, cline, windsurf, copilot, aider)")
  .option("--to <tool>", "Target tool")
  .option("--auto", "Auto-detect source and generate all missing formats")
  .option("--dry-run", "Preview without writing")
  .action(translateCommand);

program
  .command("eject")
  .description("Remove all PUIUX Pilot hooks and configuration")
  .option("--keep-hooks", "Keep hook scripts (remove from settings only)")
  .option("--force", "Skip confirmation")
  .action(ejectCommand);

program.parse();
