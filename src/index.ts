#!/usr/bin/env node

import { runAxiCli, AxiError } from "axi-sdk-js";
import { sessionsCommand } from "./commands/sessions.js";
import { newCommand } from "./commands/new.js";
import { getCommand } from "./commands/get.js";
import { approveCommand } from "./commands/approve.js";
import { messageCommand } from "./commands/message.js";
import { activitiesCommand } from "./commands/activities.js";
import { sourcesCommand } from "./commands/sources.js";
import { checkSilentCommand } from "./commands/check-silent.js";
import { watchCommand } from "./commands/watch.js";
import { resolveApiKey } from "./config.js";

const TOP_LEVEL_HELP = `jules-axi: Manage Jules — Google's async coding agent — from the CLI

Commands:
  sessions         List Jules sessions
  new              Create a new session
  get              Get session details
  approve          Approve a plan
  message          Send a message to a session
  activities       List activities for a session
  check-silent     Find completed sessions with no branch
  watch            One-shot state-change poll for a session
  sources          List registered source repos
  setup hooks      Install ambient context hooks (not yet implemented)

Flags: --help, -v/--version (built-in by AXI SDK)

Run \`jules-axi <command> --help\` for per-command help.
Run \`jules-axi\` (no args) for a live session summary.`;

function stubCommand(name: string) {
	return async (_args: string[]) => {
		return `error: \`${name}\` is not yet implemented — coming soon.
help: Run \`jules-axi sessions\` for the currently available commands.`;
	};
}

async function homeView(): Promise<string | Record<string, unknown>> {
	// Try to show live data per principle 8
	try {
		resolveApiKey();
	} catch {
		// No auth configured — show setup instructions
		return [
			"jules-axi: Manage Jules — Google's async coding agent — from the CLI",
			"",
			"auth: not configured",
			"help[1]: Set JULES_API_KEY environment variable, or",
			'help[2]: Create ~/.config/jules-axi/config.json with { "apiKey": "..." }',
			"help[3]: Run `jules-axi sessions` to list Jules sessions",
			"help[4]: Run `jules-axi sessions --help` for filtering options",
		].join("\n");
	}

	try {
		return await sessionsCommand([]);
	} catch {
		return "jules-axi: Ready\nRun `jules-axi sessions` to list Jules sessions";
	}
}

await runAxiCli({
	description: "Manage Jules — Google's async coding agent — from the CLI",
	version: "0.1.0",
	topLevelHelp: TOP_LEVEL_HELP,
	home: homeView,
	commands: {
		sessions: sessionsCommand,
		new: newCommand,
		get: getCommand,
		approve: approveCommand,
		message: messageCommand,
		activities: activitiesCommand,
		"check-silent": checkSilentCommand,
		watch: watchCommand,
		sources: sourcesCommand,
		setup: async (args) => {
			return `error: \`setup\` is not yet implemented — coming soon.
help: The setup command will install Claude/Codex/OpenCode hooks.`;
		},
	},
});
