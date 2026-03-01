# PUIUX Pilot — Tester Script

> Give this to 5-10 developers outside the core team.
> They run it on their **real projects** and report back 3 numbers.

## Prerequisites

```bash
git clone git@github.com:PUIUX-Cloud/puiux-pilot.git
cd puiux-pilot
npm ci && npm run build
```

## Steps (run inside your project directory)

```bash
PILOT="/path/to/puiux-pilot/bin/puiux-pilot.mjs"

# 1. Scan — see what Pilot detects (no changes)
node $PILOT scan

# 2. Dry-run — see what Pilot WOULD do (no changes)
node $PILOT init

# 3. Apply — actually install hooks
node $PILOT init --apply

# 4. Apply again — verify idempotency (should change nothing)
node $PILOT init --apply

# 5. Health check
node $PILOT doctor

# 6. Clean removal
node $PILOT eject
```

## What to Report

| # | Question | Your Answer |
|---|----------|-------------|
| 1 | Did `init --apply` succeed on first try? (yes/no) | |
| 2 | Did you see "Rolled back" at any point? (yes/no, which step?) | |
| 3 | Did you need manual fixes? (yes/no, what + how many minutes?) | |

## Bonus (optional)

- Did `scan` correctly detect your project type?
- Did `doctor` report anything unexpected?
- After `eject`, was your original `~/.claude/settings.json` intact?
- Any confusing output or missing information?

## Important

- **Backup first**: `cp -r ~/.claude ~/.claude-backup` before starting
- `init` without `--apply` is safe — it only shows a plan
- If anything goes wrong: `node $PILOT eject` to undo, or restore from `~/.claude-backup`
- Report issues at: https://github.com/PUIUX-Cloud/puiux-pilot/issues
