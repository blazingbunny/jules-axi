# jules-axi

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
```

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
```

## Commands

| Command        | Status     |
| -------------- | ---------- |
| `sessions`     | ✅ Working |
| `new`          | 🚧 Stub    |
| `get`          | 🚧 Stub    |
| `approve`      | 🚧 Stub    |
| `message`      | 🚧 Stub    |
| `activities`   | 🚧 Stub    |
| `check-silent` | 🚧 Stub    |
| `sources`      | 🚧 Stub    |
| `setup hooks`  | 🚧 Stub    |
