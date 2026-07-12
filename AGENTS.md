# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Build & dev

- `npm install && npm run build` — compiles TypeScript to `dist/`
- `node dist/index.js` — run the CLI locally
- `node dist/index.js sessions` — test the sessions command against real API
- `npm test` — type-checks and runs `src/commands/sessions.test.ts` (title-derivation and zero-match-suggestion assertions) plus `src/commands/commands.test.ts` (flag-validation assertions for `new`/`get`), no real API calls
- CI (`.github/workflows/ci.yml`) runs build + test on Node 20 for pushes and PRs to `main`

## Auth

- `JULES_API_KEY` env var (preferred) or `~/.config/jules-axi/config.json`
- `.jules_config.json` in cwd is deliberately NOT read — stale Bearer tokens in that file are a known footgun

## Jules API landmines this AXI guards against

- API `state` field lags real git state by 35+ min; `branch?` column cross-references local branches
- `state: COMPLETED` does not mean success — a session can complete with no branch pushed
- The `sessions` command fetches all sessions via pagination (follows `nextPageToken` in a loop), then filters client-side to the current repo by default; `--all` shows every repo instead
- Pagination is capped at 50 pages (~10,000 sessions); if the cap is hit, output includes a `warning` line noting older sessions may be missing
- `activities` recognizes a fixed set of activity type keys (`planCreated`, `planGenerated`, `planApproved`, `progressUpdated`, `artifacts`, `sessionCompleted`, `agentMessaged`, `fileCreated`, `fileEdited`, `commandRun`); anything else degrades to an `unknown activity: <key>` summary instead of crashing — extend `getActivityType`/`summarizeActivity` in `src/commands/activities.ts` when the API adds new activity shapes
- `new` runs a client-side free-tier pre-check (`checkFreeTierLimit` in `src/commands/new.ts`) before creating a session: max 15 creations/24h and 3 concurrent non-terminal sessions, derived from `fetchAllSessions`' `createTime`/`state` fields. It's best-effort only (session state lags 35+ min) and fails open on fetch errors — the real safety net is the 429/quota error handling in `createSession`'s catch block

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
