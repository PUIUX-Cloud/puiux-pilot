#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# PUIUX Pilot — Shared Hook Library
# Sourced by all hooks to eliminate duplication (~200 lines removed across 15+ hooks)
# ═══════════════════════════════════════════════════════════════════════════════

# ── Paths ─────────────────────────────────────────────────────────────────────
PILOT_HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECTS_CONFIG="$HOME/.claude/hooks/projects.json"
SETTINGS_FILE="$HOME/.claude/settings.json"
SYNC_LOG="/tmp/puiux-sync.log"
BUILD_LOG="/tmp/puiux-build.log"
METRICS_DIR="$HOME/.claude/metrics"

# ── Input Parsing ─────────────────────────────────────────────────────────────
# Replaces 15+ duplicated INPUT=$(cat) + jq blocks
# Call this first in every hook that reads stdin
HOOK_INPUT=""
HOOK_TOOL_NAME=""
HOOK_FILE_PATH=""
HOOK_COMMAND=""
HOOK_CONTENT=""

parse_hook_input() {
  HOOK_INPUT=$(cat)
  HOOK_TOOL_NAME=$(echo "$HOOK_INPUT" | jq -r '.tool_name // ""' 2>/dev/null)
  HOOK_FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null)
  HOOK_COMMAND=$(echo "$HOOK_INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null)
  HOOK_CONTENT=$(echo "$HOOK_INPUT" | jq -r '.tool_input.content // .tool_input.new_string // ""' 2>/dev/null)
}

# ── Loop Prevention ───────────────────────────────────────────────────────────
# Replaces 8 duplicated blocks across stop hooks
# Call after parse_hook_input in Stop hooks
check_stop_loop() {
  local active
  active=$(echo "$HOOK_INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)
  [ "$active" = "true" ] && exit 0
}

# ── Project Resolution ────────────────────────────────────────────────────────
# Replaces find_file() x5 and find_project_root() x2
# FIXED: Uses .projects | keys[] (correct path) instead of keys[] (bug in qa-review.sh)

# Find the full path of a relative file across all registered projects
# Usage: FULL=$(resolve_file "ui/src/styles/base.css")
resolve_file() {
  local rel="$1"
  [ ! -f "$PROJECTS_CONFIG" ] && return 1
  local paths
  paths=$(jq -r '.projects | keys[]' "$PROJECTS_CONFIG" 2>/dev/null)
  while IFS= read -r p; do
    [ -n "$p" ] && [ -f "$p/$rel" ] && echo "$p/$rel" && return 0
  done <<< "$paths"
  return 1
}

# Find which registered project a file belongs to
# Usage: PROJECT=$(resolve_project "/Users/puiux/dev/puiux/app/src/index.ts")
resolve_project() {
  local file_path="$1"
  [ ! -f "$PROJECTS_CONFIG" ] && return 1
  local paths
  paths=$(jq -r '.projects | keys[]' "$PROJECTS_CONFIG" 2>/dev/null)
  while IFS= read -r p; do
    case "$file_path" in
      "$p"/*) echo "$p"; return 0 ;;
    esac
  done <<< "$paths"
  return 1
}

# Get project metadata
project_name() {
  local proj_root="$1"
  jq -r ".projects[\"$proj_root\"].name // \"$(basename "$proj_root")\"" "$PROJECTS_CONFIG" 2>/dev/null
}

project_type() {
  local proj_root="$1"
  jq -r ".projects[\"$proj_root\"].type // \"unknown\"" "$PROJECTS_CONFIG" 2>/dev/null
}

project_container() {
  local proj_root="$1"
  jq -r ".projects[\"$proj_root\"].container // \"\"" "$PROJECTS_CONFIG" 2>/dev/null
}

# ── Modified Files (for Stop hooks) ──────────────────────────────────────────
# Replaces 9 duplicated SYNC_LOG reading patterns
# Usage: MODIFIED=$(get_modified_files '\.(ts|tsx)$')
get_modified_files() {
  local pattern="${1:-}"
  [ ! -f "$SYNC_LOG" ] && return
  local files
  files=$(grep "SYNC " "$SYNC_LOG" 2>/dev/null | sed 's/.*SYNC //' | sort -u)
  if [ -n "$pattern" ]; then
    echo "$files" | grep -E "$pattern"
  else
    echo "$files"
  fi
}

# Get list of all registered project roots
get_project_roots() {
  [ ! -f "$PROJECTS_CONFIG" ] && return
  jq -r '.projects | keys[]' "$PROJECTS_CONFIG" 2>/dev/null
}

# ── Issue Collection ──────────────────────────────────────────────────────────
# Replaces add_issue() x11 (different signatures unified)
# Flexible signature: add_issue SEVERITY "message" [file] [line]
HOOK_ISSUES=""
HOOK_ISSUE_COUNT=0
HOOK_HINTS=""
HOOK_HINT_COUNT=0

add_issue() {
  local severity="$1"
  local msg="$2"
  local file="${3:-}"
  local line="${4:-}"

  if [ -n "$file" ] && [ -n "$line" ]; then
    HOOK_ISSUES="${HOOK_ISSUES}[$severity] $file:$line — $msg\n"
  elif [ -n "$file" ]; then
    HOOK_ISSUES="${HOOK_ISSUES}[$severity] $file — $msg\n"
  else
    HOOK_ISSUES="${HOOK_ISSUES}[$severity] $msg\n"
  fi
  HOOK_ISSUE_COUNT=$((HOOK_ISSUE_COUNT + 1))
}

add_hint() {
  local msg="$1"
  HOOK_HINTS="${HOOK_HINTS}  💡 $msg\n"
  HOOK_HINT_COUNT=$((HOOK_HINT_COUNT + 1))
}

# Count issues by severity
count_severity() {
  local severity="$1"
  echo -e "$HOOK_ISSUES" | grep -c "^\[$severity\]" 2>/dev/null || echo 0
}

# ── Reporting ─────────────────────────────────────────────────────────────────
# Two modes: blocking (for PreToolUse) and advisory (for Stop)

# Block Claude from proceeding (for PreToolUse hooks)
block() {
  local reason="$1"
  echo "{\"decision\":\"block\",\"reason\":$(echo "$reason" | jq -Rs .)}"
  exit 0
}

# Report issues as advisory (for Stop hooks) — outputs to stderr
report_advisory() {
  local hook_name="$1"
  local emoji="${2:-🔍}"

  [ "$HOOK_ISSUE_COUNT" -eq 0 ] && [ "$HOOK_HINT_COUNT" -eq 0 ] && return

  local error_count
  error_count=$(count_severity "ERROR")
  local warn_count=$((HOOK_ISSUE_COUNT - error_count))

  {
    echo ""
    echo "$emoji $hook_name: $HOOK_ISSUE_COUNT issues ($error_count errors, $warn_count warnings)"
    echo -e "$HOOK_ISSUES"
    if [ "$HOOK_HINT_COUNT" -gt 0 ]; then
      echo -e "$HOOK_HINTS"
    fi
  } >&2
}

# Report and optionally block (for PostToolUse hooks that can block on errors)
report_or_block() {
  local hook_name="$1"
  local emoji="${2:-🔍}"

  [ "$HOOK_ISSUE_COUNT" -eq 0 ] && return

  local error_count
  error_count=$(count_severity "ERROR")

  if [ "$error_count" -gt 0 ]; then
    local report
    report="$emoji $hook_name: $HOOK_ISSUE_COUNT issues\n\n$HOOK_ISSUES"
    local truncated
    truncated=$(echo -e "$report" | head -20 | tr '\n' ' ')
    block "$truncated"
  else
    report_advisory "$hook_name" "$emoji"
  fi
}

# ── File Type Checks ─────────────────────────────────────────────────────────
# Quick extension checks for early exit in hooks

is_js_file() {
  case "$1" in
    *.js|*.jsx|*.ts|*.tsx|*.mjs|*.cjs) return 0 ;;
    *) return 1 ;;
  esac
}

is_css_file() {
  case "$1" in
    *.css|*.scss|*.sass|*.less) return 0 ;;
    *) return 1 ;;
  esac
}

is_html_file() {
  case "$1" in
    *.html|*.htm|*.jsx|*.tsx) return 0 ;;
    *) return 1 ;;
  esac
}

is_config_file() {
  case "$1" in
    *.json|*.yaml|*.yml|*.toml|*.ini|*.env*) return 0 ;;
    *) return 1 ;;
  esac
}

is_web_file() {
  is_js_file "$1" || is_css_file "$1" || is_html_file "$1"
}

# ── Cache Integration ─────────────────────────────────────────────────────────
# Source hook-cache if available (skip-if-unchanged optimization)
[ -f "$PILOT_HOOKS_DIR/lib/hook-cache.sh" ] && source "$PILOT_HOOKS_DIR/lib/hook-cache.sh" 2>/dev/null
# Fallback: also try the old location
[ -z "$(type -t file_hash 2>/dev/null)" ] && [ -f "$HOME/.claude/hooks/hook-cache.sh" ] && source "$HOME/.claude/hooks/hook-cache.sh" 2>/dev/null

# ── Utility ───────────────────────────────────────────────────────────────────

# Safe jq read with default value
jq_read() {
  local file="$1"
  local path="$2"
  local default="${3:-}"
  jq -r "$path // \"$default\"" "$file" 2>/dev/null || echo "$default"
}

# Check if a command exists
has_command() {
  command -v "$1" &>/dev/null
}

# Timestamp for logs
now() {
  date '+%Y-%m-%d %H:%M:%S'
}
