# PUIUX Pilot

[![CI](https://github.com/PUIUX-Cloud/puiux-pilot/actions/workflows/ci.yml/badge.svg)](https://github.com/PUIUX-Cloud/puiux-pilot/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

Adaptive AI coding assistant configurator for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).
Scans your project, selects the right hooks/MCPs/skills, and configures everything automatically.

## Quickstart

```bash
git clone git@github.com:PUIUX-Cloud/puiux-pilot.git
cd puiux-pilot
npm ci
npm run build
```

### Try it on any project

```bash
# See what Pilot would do (dry-run, no changes)
node bin/puiux-pilot.mjs init

# Actually apply
node bin/puiux-pilot.mjs init --apply

# Check health
node bin/puiux-pilot.mjs doctor

# Quality score (0-100, A-F)
node bin/puiux-pilot.mjs score

# Remove everything Pilot installed
node bin/puiux-pilot.mjs eject
```

## Commands

| Command | What it does |
|---------|-------------|
| `init` | Scan project, select hooks/MCPs/skills, show plan. **Dry-run by default.** |
| `init --apply` | Write changes (backup created first). |
| `init --force` | Overwrite user-modified hooks. |
| `scan [path]` | Analyze project without changing anything. Shows Project DNA. |
| `score [path]` | Quality assessment: 6 dimensions, 0-100, A-F grade. |
| `doctor` | Health check: broken hooks, missing scripts, timeouts, orphans. |
| `hooks list` | List all hooks with status. |
| `translate` | **[EXPERIMENTAL]** Translate config between AI coding tools. |
| `eject` | Clean removal. Restores original state from backup. |

## Safety Model

- **Dry-run by default** — `init` shows what would change without writing anything.
- **Backup before every apply** — stored in `~/.puiux-pilot/backups/<timestamp>/`.
- **Atomic writes** — temp file + rename; no partial writes on crash.
- **Rollback on failure** — if any step fails, previous state is restored.
- **Manifest-scoped uninstall** — `eject` only removes hooks Pilot installed. User hooks, permissions, and MCP configs are never touched.
- **No cloud dependency** — everything runs locally.

## What Gets Installed

Based on your project type, Pilot selects from:

- **28 hook scripts** across 6 events (PreToolUse, PostToolUse, Stop, SessionStart, PreCompact, UserPromptSubmit)
- **7 profiles**: full-stack, api-only, library, security-first, mobile, startup-speed, infra
- **MCP auto-detection**: ESLint, Prisma, Tailwind CSS, icons8, lottiefiles — based on actual dependencies
- **Skills**: clean-code, e2e-delivery, code-quality, design-standards, and more

Example: a Next.js webapp gets 28 hooks + 4 MCPs. A Node API gets 18 hooks + 0 MCPs.

## CI

GitHub Actions workflow runs on every push to `main`:

| Job | OS | What |
|-----|-----|------|
| `build-and-test` | ubuntu, windows, macos × node 18, 22 | Build + unit tests + CLI smoke |
| `release-gates` | ubuntu, macos | Full gates: 72 assertions (cold-start, repo matrix, custom hooks, failure injection) |
| `smoke-windows` | windows | Lightweight smoke: scan, init, apply, idempotency, doctor, eject |

Run gates locally: `bash tools/release-gates.sh` (uses sandboxed HOME, never touches real `~/.claude`).

## Translate (EXPERIMENTAL)

Cross-tool config translation between: CLAUDE.md, .cursorrules, .clinerules, .windsurfrules, .github/copilot-instructions.md, CONVENTIONS.md.

```bash
# Auto-detect source, generate all missing formats
node bin/puiux-pilot.mjs translate --auto

# Specific translation
node bin/puiux-pilot.mjs translate --from claude --to cursor
```

This feature is experimental. Round-trip fidelity is best-effort; tool-specific rules are preserved as comments.

## Open Core

PUIUX Pilot is **free and open source** for individual developers under the Apache 2.0 license.

**Pro for teams** (coming soon): policy packs, team sync, drift detection, private hook registry, and priority support.

See [TRADEMARKS.md](TRADEMARKS.md) for brand usage guidelines.

## License

Apache-2.0 — see [LICENSE](LICENSE) for details.
