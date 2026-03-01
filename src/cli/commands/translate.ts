/**
 * puiux-pilot translate
 * Cross-tool config translation engine
 * Translates between CLAUDE.md, .cursorrules, .clinerules, etc.
 */

import chalk from "chalk";
import ora from "ora";
import { resolve, join } from "node:path";
import { fileExists, readText } from "../../shared/fs-utils.js";
import { atomicWrite, ensureDir } from "../../shared/fs-safe.js";
import { print, printError } from "../../shared/logger.js";
import type { ToolFormat, TranslationIR, IRSection, IRRule } from "../../shared/types.js";

interface TranslateOptions {
  from?: string;
  to?: string;
  auto?: boolean;
  dryRun?: boolean;
}

// Config file patterns for each tool
const TOOL_FILES: Record<ToolFormat, string[]> = {
  claude: ["CLAUDE.md"],
  cursor: [".cursorrules", ".cursor/rules"],
  cline: [".clinerules"],
  windsurf: [".windsurfrules", ".windsurf/rules"],
  copilot: [".github/copilot-instructions.md"],
  aider: ["CONVENTIONS.md"],
};

export async function translateCommand(options: TranslateOptions): Promise<void> {
  const cwd = process.cwd();

  if (options.auto) {
    await autoTranslate(cwd, options.dryRun);
    return;
  }

  if (!options.from || !options.to) {
    printError(chalk.red("  Usage: puiux-pilot translate --from <tool> --to <tool>"));
    printError(chalk.dim("  Or: puiux-pilot translate --auto"));
    printError(chalk.dim("  Tools: claude, cursor, cline, windsurf, copilot, aider"));
    process.exitCode = 1;
    return;
  }

  const from = options.from as ToolFormat;
  const to = options.to as ToolFormat;

  if (!TOOL_FILES[from] || !TOOL_FILES[to]) {
    printError(chalk.red(`  Unknown tool: ${!TOOL_FILES[from] ? from : to}`));
    process.exitCode = 1;
    return;
  }

  const spinner = ora(`Translating ${from} → ${to}...`).start();

  try {
    // Find source file
    const sourceFile = await findToolConfig(cwd, from);
    if (!sourceFile) {
      spinner.fail(`No ${from} config found in ${cwd}`);
      process.exitCode = 1;
      return;
    }

    // Parse source
    const content = await readText(sourceFile);
    const ir = parseToIR(content, from, sourceFile);

    // Generate target
    const output = generateFromIR(ir, to);

    if (options.dryRun) {
      spinner.stop();
      return;
    }

    // Write target
    const targetPath = getTargetPath(cwd, to);
    await ensureDir(join(cwd, ".github"));
    await atomicWrite(targetPath, output);

    spinner.succeed(
      `Translated ${ir.sections.length} sections (${countRules(ir)} rules) → ${targetPath}`
    );
  } catch (err) {
    spinner.fail("Translation failed");
    printError(String(err));
    process.exitCode = 1;
  }
}

async function autoTranslate(cwd: string, dryRun?: boolean): Promise<void> {

  // Detect existing configs
  let sourceFormat: ToolFormat | null = null;
  let sourcePath: string | null = null;

  for (const [tool, files] of Object.entries(TOOL_FILES)) {
    for (const file of files) {
      const full = join(cwd, file);
      if (await fileExists(full)) {
        if (!sourceFormat) {
          sourceFormat = tool as ToolFormat;
          sourcePath = full;
        } else {
        }
      }
    }
  }

  if (!sourceFormat || !sourcePath) {
    return;
  }

  // Parse source
  const content = await readText(sourcePath);
  const ir = parseToIR(content, sourceFormat, sourcePath);

  // Generate missing formats
  for (const [tool] of Object.entries(TOOL_FILES)) {
    if (tool === sourceFormat) continue;

    const existing = await findToolConfig(cwd, tool as ToolFormat);
    if (existing) {
      continue;
    }

    const output = generateFromIR(ir, tool as ToolFormat);
    const targetPath = getTargetPath(cwd, tool as ToolFormat);

    if (dryRun) {
      // skip
    } else {
      await ensureDir(join(cwd, ".github"));
      await atomicWrite(targetPath, output);
    }
  }

}

// ─── Parsing ─────────────────────────────────────────────────────────────────

function parseToIR(
  content: string,
  format: ToolFormat,
  sourcePath: string
): TranslationIR {
  const sections: IRSection[] = [];

  // Split by ## headers
  const parts = content.split(/^## /m).filter(Boolean);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const lines = part.split("\n");
    const title = lines[0].replace(/^#+\s*/, "").trim();
    const body = lines.slice(1).join("\n").trim();

    if (!body) continue;

    const rules: IRRule[] = [];

    // Extract bullet points as rules
    const bullets = body.match(/^[-*]\s+.+$/gm) || [];
    for (let j = 0; j < bullets.length; j++) {
      rules.push({
        id: `rule-${i}-${j}`,
        content: bullets[j].replace(/^[-*]\s+/, ""),
        priority: bullets[j].toLowerCase().includes("must") ? "must" : "should",
      });
    }

    // If no bullets, treat paragraphs as rules
    if (rules.length === 0 && body.length > 0) {
      rules.push({
        id: `rule-${i}-0`,
        content: body,
        priority: "should",
      });
    }

    sections.push({
      id: `section-${i}`,
      title,
      category: inferCategory(title),
      rules,
    });
  }

  return {
    meta: {
      source: format,
      sourceFile: sourcePath,
      generatedAt: new Date().toISOString(),
    },
    sections,
  };
}

function inferCategory(title: string): IRSection["category"] {
  const lower = title.toLowerCase();
  if (lower.includes("style") || lower.includes("format")) return "coding-style";
  if (lower.includes("arch") || lower.includes("structure")) return "architecture";
  if (lower.includes("test")) return "testing";
  if (lower.includes("workflow") || lower.includes("process")) return "workflow";
  if (lower.includes("secur")) return "security";
  if (lower.includes("tool")) return "tooling";
  if (lower.includes("convention") || lower.includes("pattern")) return "conventions";
  return "project-context";
}

// ─── Generation ──────────────────────────────────────────────────────────────

function generateFromIR(ir: TranslationIR, target: ToolFormat): string {
  switch (target) {
    case "claude":
      return generateClaudeMd(ir);
    case "cursor":
      return generateCursorRules(ir);
    case "cline":
      return generateClineRules(ir);
    case "windsurf":
      return generateWindsurfRules(ir);
    case "copilot":
      return generateCopilotInstructions(ir);
    case "aider":
      return generateConventions(ir);
    default:
      return generateClaudeMd(ir);
  }
}

function generateClaudeMd(ir: TranslationIR): string {
  const lines = [`# Project Rules\n`];
  lines.push(`<!-- Generated by PUIUX Pilot from ${ir.meta.source} -->\n`);

  for (const section of ir.sections) {
    lines.push(`## ${section.title}\n`);
    for (const rule of section.rules) {
      if (rule.toolSpecific && rule.toolSpecific.tool !== "claude") {
        lines.push(`<!-- [${rule.toolSpecific.tool}-specific] ${rule.content} -->`);
      } else {
        lines.push(`- ${rule.content}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

function generateCursorRules(ir: TranslationIR): string {
  const lines: string[] = [];
  lines.push(`# Generated by PUIUX Pilot from ${ir.meta.source}\n`);

  for (const section of ir.sections) {
    lines.push(`## ${section.title}\n`);
    for (const rule of section.rules) {
      if (rule.toolSpecific && rule.toolSpecific.tool !== "cursor") {
        continue; // Skip tool-specific rules for other tools
      }
      lines.push(`- ${rule.content}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function generateClineRules(ir: TranslationIR): string {
  // .clinerules is markdown, similar to CLAUDE.md
  return generateClaudeMd(ir).replace("# Project Rules", "# Cline Rules");
}

function generateWindsurfRules(ir: TranslationIR): string {
  // Windsurf has 6000 char per file limit
  let output = `# Generated by PUIUX Pilot from ${ir.meta.source}\n\n`;

  for (const section of ir.sections) {
    const sectionText = `## ${section.title}\n${section.rules.map((r) => `- ${r.content}`).join("\n")}\n\n`;
    if (output.length + sectionText.length > 5800) {
      output += `\n<!-- Truncated: remaining sections exceed Windsurf 6000 char limit -->\n`;
      break;
    }
    output += sectionText;
  }

  return output;
}

function generateCopilotInstructions(ir: TranslationIR): string {
  const lines: string[] = [];
  lines.push(`# GitHub Copilot Instructions`);
  lines.push(`<!-- Generated by PUIUX Pilot from ${ir.meta.source} -->\n`);

  for (const section of ir.sections) {
    lines.push(`## ${section.title}\n`);
    for (const rule of section.rules) {
      lines.push(`- ${rule.content}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function generateConventions(ir: TranslationIR): string {
  // CONVENTIONS.md for Aider
  const lines: string[] = [];
  lines.push(`# Project Conventions`);
  lines.push(`<!-- Generated by PUIUX Pilot from ${ir.meta.source} -->\n`);

  for (const section of ir.sections) {
    lines.push(`## ${section.title}\n`);
    for (const rule of section.rules) {
      lines.push(`- ${rule.content}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function findToolConfig(
  cwd: string,
  tool: ToolFormat
): Promise<string | null> {
  const files = TOOL_FILES[tool];
  for (const file of files) {
    const full = join(cwd, file);
    if (await fileExists(full)) return full;
  }
  return null;
}

function getTargetPath(cwd: string, tool: ToolFormat): string {
  return join(cwd, TOOL_FILES[tool][0]);
}

function countRules(ir: TranslationIR): number {
  return ir.sections.reduce((sum, s) => sum + s.rules.length, 0);
}
