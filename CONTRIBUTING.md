# Contributing to PUIUX Pilot

Thanks for your interest in contributing.

## Ground rules

- **Safety first:** This tool writes to developer configuration. Any change must preserve:
  - Dry-run default
  - Atomic writes
  - Backup + rollback
  - Uninstall scoped to the manifest
- **No scope creep in PRs:** One change per PR.

## Development setup

```bash
npm ci
npm run build
npm test
bash tools/release-gates.sh
```

## What to contribute

### Great first contributions

- Add new project detectors (small, deterministic signals).
- Improve docs and examples.
- Add tests for edge cases.
- Improve portability (paths, permissions, Windows smoke).

### Hooks

If you add or modify hooks:

- Keep hooks deterministic and fast.
- Avoid destructive behavior.
- Document: event, matcher, timeout, required conditions, and expected side effects.

## Pull request requirements

A PR will be accepted only if:

- `npm test` passes
- `npm run build` passes
- `bash tools/release-gates.sh` passes on macOS or Linux
- Changes are minimal and focused
- Any behavior change includes tests

## Security

If you believe you found a security issue, do **not** open a public issue.
Instead, contact maintainers privately.

## License of contributions

By submitting a contribution, you agree that your contribution is licensed under the project license (Apache-2.0).
