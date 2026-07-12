# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Build & dev

- `npm install && npm run build` — compiles TypeScript to `dist/`
- `node dist/index.js` — run the CLI locally
- `node dist/index.js sessions` — test the sessions command against real API

## Auth

- `JULES_API_KEY` env var (preferred) or `~/.config/jules-axi/config.json`
- `.jules_config.json` in cwd is deliberately NOT read — stale Bearer tokens in that file are a known footgun

## Jules API landmines this AXI guards against

- API `state` field lags real git state by 35+ min; `branch?` column cross-references local branches
- `state: COMPLETED` does not mean success — a session can complete with no branch pushed
- The `sessions` command truncates to 20 by default with a `--all` escape hatch

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
