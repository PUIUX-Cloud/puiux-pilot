# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in PUIUX Pilot, **do not open a public issue**.

Instead, please report it privately:

- **Email**: welcome@puiux.com
- **Subject**: `[SECURITY] PUIUX Pilot — <brief description>`

We will acknowledge receipt within 48 hours and provide a detailed response within 5 business days.

## Scope

PUIUX Pilot writes to `~/.claude/settings.json` and `~/.claude/hooks/`. A security issue in this context means:

- Unintended file writes outside expected paths
- Execution of arbitrary code through hook injection
- Exposure of secrets or credentials
- Bypass of the backup/rollback safety model

## Supported versions

| Version | Supported |
|---------|-----------|
| Latest release | Yes |
| Older releases | Best-effort |

## Disclosure policy

- We follow responsible disclosure. We will coordinate with reporters on timing.
- Credit will be given to reporters unless they prefer to remain anonymous.
- We do not pursue legal action against good-faith security researchers.
