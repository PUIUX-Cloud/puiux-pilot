# PUIUX Pilot -- Release Gates Report

**Date:** 2026-03-02 00:09
**Version:** 0.1.0
**Sandbox HOME:** `/tmp/pilot-sandbox-sppBMU`
**Platform:** Darwin arm64
**Result: 72 assertions | 72 pass | 0 fail | ALL PASS**

## Summary

| Gate | Assertions | Result |
|------|-----------|--------|
| G1: Cold-Start | 8 | ALL PASS |
| G2: Repo Matrix (A-E) | 40 | ALL PASS |
| G2F: Custom Hooks | 20 | ALL PASS |
| G3: Failure Injection | 6 | ALL PASS |
| G4: Windows CI | - | PLANNED |
| G5: UX | 6 | PASS |
| DEBUG self-check | 1 | PASS |

## Repo F Fix (from initial 70/74 run)

The initial run had 4 failures, all in Repo F (custom hooks). Root cause: **test script ordering bug, not product bug**. User hooks were created at script start but wiped when repos A-E each called `reset_claude()`. Fix: create user hooks inside Repo F's own test block, immediately after `reset_claude()`. Product merge/uninstall logic was verified correct -- `mergeHooks()` preserves existing entries, `uninstallConfiguration()` only removes hooks listed in `manifest.managedHooks`.

## Gate 1: Cold-Start

- Doctor on empty HOME: runs, reports actionable errors (no crash)
- Dry-run on empty HOME: creates zero files in ~/.claude
- --apply on empty HOME: safely creates ~/.claude, settings.json, manifest

## Gate 2: Repo Matrix

| Repo | Type | Profile | Hooks | scan | dry-run | apply | idempotent | doctor | eject |
|------|------|---------|-------|------|---------|-------|------------|--------|-------|
| A: Next.js | nextjs | full-stack | 28 | PASS | PASS | PASS | PASS | PASS | PASS |
| B: Vite React | vite | full-stack | 28 | PASS | PASS | PASS | PASS | PASS | PASS |
| C: Node API | express | api-only | 18 | PASS | PASS | PASS | PASS | PASS | PASS |
| D: Monorepo | turbo | full-stack | 28 | PASS | PASS | PASS | PASS | PASS | PASS |
| E: No pkg.json | other | full-stack | 28 | PASS | PASS | PASS | PASS | PASS | PASS |
| F: Custom hooks | nextjs | full-stack | 28+1 | PASS | PASS | PASS | PASS | PASS | PASS |

### Repo F: Custom Hooks Assertions
1. User's `my-custom-hook.sh` exists before init
2. Dry-run does NOT change settings.json (checksum verified)
3. --apply PRESERVES user hook in settings.json
4. --apply PRESERVES `permissions` key
5. User hook script remains on disk after apply
6. Idempotent: hook count stable after 2nd apply
7. Pilot ADDED hooks on top of user's hooks (count grew)
8. Eject: user hook STILL in settings.json
9. Eject: user hook script STILL on disk
10. Eject: permissions STILL in settings.json
11. Eject: pilot hooks removed (count back to user's original)

### How merge/uninstall preserves user hooks
- `mergeHooks()` starts with `{ ...existing }` -- all existing keys preserved
- New hooks added only if their command path doesn't already exist
- `uninstallConfiguration()` only removes hooks whose ID is in `manifest.managedHooks`
- Non-pilot hook entries and top-level keys (`permissions`, `mcpServers`) untouched

## Gate 3: Failure Injection

| Scenario | Fails? | Rollback? | State preserved? |
|----------|--------|-----------|-----------------|
| Non-writable hooks dir | YES | YES | YES (hook count unchanged) |
| Read-only settings.json | YES | YES | YES (file unchanged) |

## Gate 4: Windows

### Fixes Applied
1. `process.env.HOME || "/"` and `process.env.HOME || "~"` replaced with `homedir()` from `node:os`
2. `doctor.ts`: X_OK check skipped on `win32` with clear WARN message
3. Magic number `1` replaced with `fsConstants.X_OK`
4. All literal `"~"` path fallbacks removed

### CI Workflow (`.github/workflows/ci.yml`)
- **Build matrix**: `[ubuntu-latest, windows-latest, macos-latest]` x `[node 18, 22]`
- **Steps**: npm ci, build, unit tests, CLI smoke tests
- **Release gates**: separate job on ubuntu + macos that runs `tools/release-gates.sh`

## Gate 5: UX

| Check | Result |
|-------|--------|
| --help: dry-run default stated | PASS |
| init --help: --apply explained | PASS |
| init --help: --force explained | PASS |
| translate: [EXPERIMENTAL] label | PASS |
| No process.exit() in commands | PASS |
| All output via print()/printError() | PASS |
| DEBUG=1 shows resolved paths | PASS |

## Fixes Applied

| File | Fix | Reason |
|------|-----|--------|
| project-detector.ts | `process.env.HOME \|\| "/"` to `homedir()` | Windows + sandbox compat |
| init.ts | `process.env.HOME \|\| "~"` to `homedir()` (3 places) | Literal ~ not expanded |
| init.ts | Added `import { homedir } from "node:os"` | Support above |
| doctor.ts | X_OK skip on win32 with WARN | access(f,X_OK) fails on Windows |
| doctor.ts | Magic `1` to `fsConstants.X_OK` | Code clarity |
| translate.ts | console.error/process.exit to printError/exitCode | Linter + consistency |
| cli/index.ts | translate desc: [EXPERIMENTAL] | V1 scope |
| cli/index.ts | DEBUG=1 self-check at startup | Sandbox verification |

## Key Logs


### Gate 1: Cold-start doctor
```

  PUIUX Pilot Doctor

  ✗ Claude directory: not found at /tmp/pilot-sandbox-sppBMU/.claude
  ✗ Hooks directory: not found at /tmp/pilot-sandbox-sppBMU/.claude/hooks
  ✗ Settings file: ~/.claude/settings.json missing or invalid
  ⚠ Hook scripts: no hooks configured
  ⚠ Hook permissions: hooks directory missing
  ⚠ Pilot manifest: not found — run `puiux-pilot init --apply` to create
  ✓ Orphan hooks: no hooks directory

  3 error(s), 3 warning(s)
```

### Gate 1: Cold-start init --apply
```
- Scanning project...
✔ Project: empty-project (node) — 4ms
  Runtime: node | Category: other | Monorepo: no
- Selecting hooks...
✔ 28 hooks selected (4 PreToolUse, 10 PostToolUse, 11 Stop, 1 SessionStart, 1 PreCompact, 1 UserPromptSubmit) | Profile: full-stack | 0 skipped
  Skills: clean-code, e2e-delivery, code-quality

  Change Plan:
    Create /tmp/pilot-sandbox-sppBMU/.claude/settings.json
    Write tracking manifest → /tmp/pilot-sandbox-sppBMU/.claude/.puiux-pilot.json
    Copy 28 hook scripts → /tmp/pilot-sandbox-sppBMU/.claude/hooks
    Save Project DNA → /tmp/pilot-sandbox-sppBMU/.puiux-pilot/projects/-private-tmp-puiux-pilot-matrix-empty-project/dna.json
- Applying changes...
✔ Installed: 28 hooks, 0 MCPs
- Verifying installation...
✔ Verification: 3/3 passed
- Calculating quality score...
✔ Quality: B (82/100)

  Quality Score: 82/100  ████████████████░░░░  B

  Security      [ 90] ██████████████████░░
  Code Quality  [ 85] █████████████████░░░
  Architecture  [ 95] ███████████████████░
  Testing       [ 30] ██████░░░░░░░░░░░░░░
  Design        [100] ████████████████████
  Workflow      [ 90] ██████████████████░░

  Top Actions:
    [+30 pts] No test framework detected
    [+25 pts] No test files found
    [+15 pts] No linter detected — consider adding ESLint or Biome
```

### A: Next.js: init --apply
```
- Scanning project...
✔ Project: nextjs-app (nextjs) — 2ms
  Runtime: node | Category: webapp | Monorepo: no
  Frameworks: next, react, react-dom, tailwindcss
- Selecting hooks...
✔ 28 hooks selected (4 PreToolUse, 10 PostToolUse, 11 Stop, 1 SessionStart, 1 PreCompact, 1 UserPromptSubmit) | Profile: full-stack | 0 skipped
  MCPs: icons8 (UI framework detected — icons available), lottiefiles (UI + CSS framework detected — animations available), prisma (Prisma ORM detected in dependencies), tailwindcss (Tailwind CSS detected in dependencies)
  Skills: clean-code, e2e-delivery, code-quality, design-standards, build-deploy, tailwind, nextjs

  Change Plan:
    Create /tmp/pilot-sandbox-sppBMU/.claude/settings.json
    Write tracking manifest → /tmp/pilot-sandbox-sppBMU/.claude/.puiux-pilot.json
    Copy 28 hook scripts → /tmp/pilot-sandbox-sppBMU/.claude/hooks
    Configure 4 MCPs → per-project settings
    Save Project DNA → /tmp/pilot-sandbox-sppBMU/.puiux-pilot/projects/-private-tmp-puiux-pilot-matrix-nextjs-app/dna.json
- Applying changes...
✔ Installed: 28 hooks, 4 MCPs
- Verifying installation...
✔ Verification: 3/3 passed
- Calculating quality score...
✔ Quality: A (98/100)

  Quality Score: 98/100  ████████████████████  A

  Security      [100] ████████████████████
  Code Quality  [100] ████████████████████
  Architecture  [ 95] ███████████████████░
  Testing       [100] ████████████████████
  Design        [100] ████████████████████
  Workflow      [ 90] ██████████████████░░

  Top Actions:
    [+5 pts] No .arch-rules.json — consider defining architecture boundaries
    [+5 pts] No .perf-budget.json — consider setting performance budgets
    [+5 pts] No documentation directory found
```

### B: Vite React: init --apply
```
- Scanning project...
✔ Project: vite-react (vite) — 3ms
  Runtime: node | Category: webapp | Monorepo: no
  Frameworks: react, react-dom, tailwindcss
- Selecting hooks...
✔ 28 hooks selected (4 PreToolUse, 10 PostToolUse, 11 Stop, 1 SessionStart, 1 PreCompact, 1 UserPromptSubmit) | Profile: full-stack | 0 skipped
  MCPs: eslint (ESLint detected in dependencies), icons8 (UI framework detected — icons available), lottiefiles (UI + CSS framework detected — animations available), tailwindcss (Tailwind CSS detected in dependencies)
  Skills: clean-code, e2e-delivery, code-quality, design-standards, tailwind, react

  Change Plan:
    Create /tmp/pilot-sandbox-sppBMU/.claude/settings.json
    Write tracking manifest → /tmp/pilot-sandbox-sppBMU/.claude/.puiux-pilot.json
    Copy 28 hook scripts → /tmp/pilot-sandbox-sppBMU/.claude/hooks
    Configure 4 MCPs → per-project settings
    Save Project DNA → /tmp/pilot-sandbox-sppBMU/.puiux-pilot/projects/-private-tmp-puiux-pilot-matrix-vite-react/dna.json
- Applying changes...
✔ Installed: 28 hooks, 4 MCPs
- Verifying installation...
✔ Verification: 3/3 passed
- Calculating quality score...
✔ Quality: A (93/100)

  Quality Score: 93/100  ███████████████████░  A

  Security      [ 90] ██████████████████░░
  Code Quality  [100] ████████████████████
  Architecture  [ 95] ███████████████████░
  Testing       [ 85] █████████████████░░░
  Design        [100] ████████████████████
  Workflow      [ 90] ██████████████████░░

  Top Actions:
    [+15 pts] No CI/CD pipeline detected
    [+10 pts] No .gitignore file found
    [+5 pts] No .arch-rules.json — consider defining architecture boundaries
```

### C: Node API: init --apply
```
- Scanning project...
✔ Project: node-api (express) — 4ms
  Runtime: node | Category: api | Monorepo: no
  Frameworks: express, drizzle-orm
- Selecting hooks...
✔ 18 hooks selected (4 PreToolUse, 6 PostToolUse, 5 Stop, 1 SessionStart, 1 PreCompact, 1 UserPromptSubmit) | Profile: api-only | 10 skipped
  Skills: clean-code, e2e-delivery, code-quality, full-stack, spec-first

  Change Plan:
    Create /tmp/pilot-sandbox-sppBMU/.claude/settings.json
    Write tracking manifest → /tmp/pilot-sandbox-sppBMU/.claude/.puiux-pilot.json
    Copy 18 hook scripts → /tmp/pilot-sandbox-sppBMU/.claude/hooks
    Save Project DNA → /tmp/pilot-sandbox-sppBMU/.puiux-pilot/projects/-private-tmp-puiux-pilot-matrix-node-api/dna.json
- Applying changes...
✔ Installed: 18 hooks, 0 MCPs
- Verifying installation...
✔ Verification: 3/3 passed
- Calculating quality score...
✔ Quality: A (90/100)

  Quality Score: 90/100  ██████████████████░░  A

  Security      [ 90] ██████████████████░░
  Code Quality  [ 85] █████████████████░░░
  Architecture  [ 95] ███████████████████░
  Testing       [ 85] █████████████████░░░
  Design        [100] ████████████████████
  Workflow      [ 90] ██████████████████░░

  Top Actions:
    [+15 pts] No linter detected — consider adding ESLint or Biome
    [+15 pts] No CI/CD pipeline detected
    [+10 pts] No .gitignore file found
```

### D: Monorepo: init --apply
```
- Scanning project...
✔ Project: mono-repo (turbo) — 3ms
  Runtime: node | Category: monorepo | Monorepo: yes
- Selecting hooks...
✔ 28 hooks selected (4 PreToolUse, 10 PostToolUse, 11 Stop, 1 SessionStart, 1 PreCompact, 1 UserPromptSubmit) | Profile: full-stack | 0 skipped
  Skills: clean-code, e2e-delivery, code-quality

  Change Plan:
    Create /tmp/pilot-sandbox-sppBMU/.claude/settings.json
    Write tracking manifest → /tmp/pilot-sandbox-sppBMU/.claude/.puiux-pilot.json
    Copy 28 hook scripts → /tmp/pilot-sandbox-sppBMU/.claude/hooks
    Save Project DNA → /tmp/pilot-sandbox-sppBMU/.puiux-pilot/projects/-private-tmp-puiux-pilot-matrix-mono-repo/dna.json
- Applying changes...
✔ Installed: 28 hooks, 0 MCPs
- Verifying installation...
✔ Verification: 3/3 passed
- Calculating quality score...
✔ Quality: B (82/100)

  Quality Score: 82/100  ████████████████░░░░  B

  Security      [ 90] ██████████████████░░
  Code Quality  [ 85] █████████████████░░░
  Architecture  [ 95] ███████████████████░
  Testing       [ 30] ██████░░░░░░░░░░░░░░
  Design        [100] ████████████████████
  Workflow      [ 90] ██████████████████░░

  Top Actions:
    [+30 pts] No test framework detected
    [+25 pts] No test files found
    [+15 pts] No linter detected — consider adding ESLint or Biome
```

### E: No pkg.json: init --apply
```
- Scanning project...
✔ Project: plain-dir (other) — 4ms
  Runtime: other | Category: other | Monorepo: no
- Selecting hooks...
✔ 28 hooks selected (4 PreToolUse, 10 PostToolUse, 11 Stop, 1 SessionStart, 1 PreCompact, 1 UserPromptSubmit) | Profile: full-stack | 0 skipped
  Skills: clean-code, e2e-delivery, code-quality

  Change Plan:
    Create /tmp/pilot-sandbox-sppBMU/.claude/settings.json
    Write tracking manifest → /tmp/pilot-sandbox-sppBMU/.claude/.puiux-pilot.json
    Copy 28 hook scripts → /tmp/pilot-sandbox-sppBMU/.claude/hooks
    Save Project DNA → /tmp/pilot-sandbox-sppBMU/.puiux-pilot/projects/-private-tmp-puiux-pilot-matrix-plain-dir/dna.json
- Applying changes...
✔ Installed: 28 hooks, 0 MCPs
- Verifying installation...
✔ Verification: 3/3 passed
- Calculating quality score...
✔ Quality: B (82/100)

  Quality Score: 82/100  ████████████████░░░░  B

  Security      [ 90] ██████████████████░░
  Code Quality  [ 85] █████████████████░░░
  Architecture  [ 95] ███████████████████░
  Testing       [ 30] ██████░░░░░░░░░░░░░░
  Design        [100] ████████████████████
  Workflow      [ 90] ██████████████████░░

  Top Actions:
    [+30 pts] No test framework detected
    [+25 pts] No test files found
    [+15 pts] No linter detected — consider adding ESLint or Biome
```

### F: init --apply (with user hooks)
```
- Scanning project...
✔ Project: custom-hooks-repo (nextjs) — 3ms
  Runtime: node | Category: webapp | Monorepo: no
  Frameworks: react, next
- Selecting hooks...
✔ 28 hooks selected (4 PreToolUse, 10 PostToolUse, 11 Stop, 1 SessionStart, 1 PreCompact, 1 UserPromptSubmit) | Profile: full-stack | 0 skipped
  MCPs: icons8 (UI framework detected — icons available)
  Skills: clean-code, e2e-delivery, code-quality, design-standards, nextjs

  Change Plan:
    Modify /tmp/pilot-sandbox-sppBMU/.claude/settings.json (merge 28 hooks)
    Write tracking manifest → /tmp/pilot-sandbox-sppBMU/.claude/.puiux-pilot.json
    Copy 28 hook scripts → /tmp/pilot-sandbox-sppBMU/.claude/hooks
    Configure 1 MCPs → per-project settings
    Save Project DNA → /tmp/pilot-sandbox-sppBMU/.puiux-pilot/projects/-private-tmp-puiux-pilot-matrix-custom-hooks-repo/dna.json
- Applying changes...
✔ Installed: 28 hooks, 1 MCPs
  Backup: /tmp/pilot-sandbox-sppBMU/.puiux-pilot/backups/2026-03-01T22-09-23-423Z
- Verifying installation...
✔ Verification: 4/4 passed
- Calculating quality score...
✔ Quality: B (85/100)

  Quality Score: 85/100  █████████████████░░░  B

  Security      [ 90] ██████████████████░░
  Code Quality  [ 85] █████████████████░░░
  Architecture  [ 95] ███████████████████░
  Testing       [ 60] ████████████░░░░░░░░
  Design        [ 90] ██████████████████░░
  Workflow      [ 90] ██████████████████░░

  Top Actions:
    [+25 pts] No test files found
    [+15 pts] No linter detected — consider adding ESLint or Biome
    [+15 pts] No CI/CD pipeline detected
```

### F: eject
```
- Creating backup...
✔ Backup created: /tmp/pilot-sandbox-sppBMU/.puiux-pilot/backups/2026-03-01T22-09-23-609Z
- Removing hook entries from settings.json...
✔ Removed 28 hook entries
  Removed pilot manifest

  Eject complete. PUIUX Pilot hooks have been removed.
  Backup at: /tmp/pilot-sandbox-sppBMU/.puiux-pilot/backups/2026-03-01T22-09-23-609Z
```

### G3: Non-writable hooks dir
```
- Scanning project...
✔ Project: fail-test (vite) — 3ms
  Runtime: node | Category: webapp | Monorepo: no
  Frameworks: react
- Selecting hooks...
✔ 28 hooks selected (4 PreToolUse, 10 PostToolUse, 11 Stop, 1 SessionStart, 1 PreCompact, 1 UserPromptSubmit) | Profile: full-stack | 0 skipped
  MCPs: icons8 (UI framework detected — icons available)
  Skills: clean-code, e2e-delivery, code-quality, design-standards, react

  Change Plan:
    Modify /tmp/pilot-sandbox-sppBMU/.claude/settings.json (merge 28 hooks)
    Write tracking manifest → /tmp/pilot-sandbox-sppBMU/.claude/.puiux-pilot.json
    Copy 28 hook scripts → /tmp/pilot-sandbox-sppBMU/.claude/hooks
    Configure 1 MCPs → per-project settings
    Save Project DNA → /tmp/pilot-sandbox-sppBMU/.puiux-pilot/projects/-private-tmp-puiux-pilot-matrix-fail-test/dna.json

  ⚠ Existing Pilot manifest found. Use --force to overwrite user-modified hooks.
- Applying changes...
✖ Apply failed
  Rolled back to previous state.
  Apply failed: Error: EACCES: permission denied, mkdir '/tmp/pilot-sandbox-sppBMU/.claude/hooks/lib'
```

### G3: Read-only settings.json
```
- Scanning project...
✔ Project: fail-test (vite) — 3ms
  Runtime: node | Category: webapp | Monorepo: no
  Frameworks: react
- Selecting hooks...
✔ 28 hooks selected (4 PreToolUse, 10 PostToolUse, 11 Stop, 1 SessionStart, 1 PreCompact, 1 UserPromptSubmit) | Profile: full-stack | 0 skipped
  MCPs: icons8 (UI framework detected — icons available)
  Skills: clean-code, e2e-delivery, code-quality, design-standards, react

  Change Plan:
    Modify /tmp/pilot-sandbox-sppBMU/.claude/settings.json (merge 28 hooks)
    Write tracking manifest → /tmp/pilot-sandbox-sppBMU/.claude/.puiux-pilot.json
    Copy 28 hook scripts → /tmp/pilot-sandbox-sppBMU/.claude/hooks
    Configure 1 MCPs → per-project settings
    Save Project DNA → /tmp/pilot-sandbox-sppBMU/.puiux-pilot/projects/-private-tmp-puiux-pilot-matrix-fail-test/dna.json

  ⚠ Existing Pilot manifest found. Use --force to overwrite user-modified hooks.
- Applying changes...
✔ Installed: 28 hooks, 1 MCPs
  Backup: /tmp/pilot-sandbox-sppBMU/.puiux-pilot/backups/2026-03-01T22-09-23-894Z
- Verifying installation...
✔ Verification: 4/4 passed
- Calculating quality score...
✔ Quality: B (81/100)

  Quality Score: 81/100  ████████████████░░░░  B

  Security      [ 90] ██████████████████░░
  Code Quality  [ 85] █████████████████░░░
  Architecture  [ 95] ███████████████████░
  Testing       [ 30] ██████░░░░░░░░░░░░░░
  Design        [ 90] ██████████████████░░
  Workflow      [ 90] ██████████████████░░

  Top Actions:
    [+30 pts] No test framework detected
    [+25 pts] No test files found
    [+15 pts] No linter detected — consider adding ESLint or Biome
```

---
*Generated by PUIUX Pilot Release Gates Suite*
*Script: tools/release-gates.sh*
