# jules-axi

[![CI](https://github.com/blazingbunny/jules-axi/actions/workflows/ci.yml/badge.svg)](https://github.com/blazingbunny/jules-axi/actions/workflows/ci.yml)

AXI CLI for [Jules](https://jules.google.com) — Google's async coding agent.

Agent-native CLI built on the [AXI](https://axi.md) design principles: token-efficient TOON output, minimal schemas, pre-computed aggregates, and structured errors.

## Install

```bash
npm install -g jules-axi
```

## Auth

Set your Jules API key via one of:

1. **Environment variable** (recommended):
   ```bash
   export JULES_API_KEY="your-key-here"
   ```

2. **Config file**: `~/.config/jules-axi/config.json`
   ```json
   { "apiKey": "your-key-here" }
   ```

> Note: `.jules_config.json` in the current directory is NOT read — it's a known footgun (stale Bearer tokens silently override the API key).

## Usage

```bash
# Home view — live session summary
jules-axi

# List sessions (fetches all sessions via pagination, filters to the current git repo)
jules-axi sessions

# Filter by repo
jules-axi sessions --repo blazingbunny/jules-axi

# Filter by state
jules-axi sessions --state AWAITING_USER_FEEDBACK

# Show all sessions
jules-axi sessions --all

# Create a new session
jules-axi new --repo blazingbunny/jules-axi --prompt "Add pagination support"
cat task.md | jules-axi new --repo blazingbunny/jules-axi

# Get full details for a session
jules-axi get 1234567890

# Approve a pending plan
jules-axi approve 1234567890

# Send a message to a session
jules-axi message 1234567890 --text "Please add tests"

# List activities for a session (truncates to latest 15 unless --full)
jules-axi activities 1234567890
jules-axi activities 1234567890 --full

# Find COMPLETED sessions with no local branch ("silent failures")
jules-axi check-silent

# One-shot state-change poll for a session (for cron/scheduler loops)
jules-axi watch 1234567890

# List registered source repos
jules-axi sources
```

Every command supports `--help` for its full flag reference.

### Output format

Uses [TOON](https://toonformat.dev/) for ~40% token savings:

```
count: 3 of 3 total
sessions[3]{id,title,state,repo,branch?}:
  "8675309123456789","Add pagination support",IN_PROGRESS,blazingbunny/jules-axi,yes
  ...
help[1]: Run `jules-axi sessions --state AWAITING_USER_FEEDBACK` to find sessions that need input
```

The `branch?` column shows whether a git branch exists for each session — API state alone can lag by 35+ minutes, so this avoids trusting it blindly.

Pagination stops after 50 pages (~10,000 sessions). If that cap is hit, a `warning` line is added to the output noting that older sessions may be missing.

## Agent integration

```bash
# Coming soon: install ambient context hooks for Claude Code, Codex, and OpenCode
jules-axi setup hooks
```

Add to your `AGENTS.md`:

```
Use `jules-axi` for managing Jules sessions.
```

## Development

```bash
npm install
npm run build
npm start
npm test
```

## Commands

| Command        | Status     |
| -------------- | ---------- |
| `sessions`     | ✅ Working |
| `new`          | ✅ Working |
| `get`          | ✅ Working |
| `approve`      | ✅ Working |
| `message`      | ✅ Working |
| `activities`   | ✅ Working |
| `check-silent` | ✅ Working |
| `watch`        | ✅ Working |
| `sources`      | ✅ Working |
| `setup hooks`  | 🚧 Stub    |
