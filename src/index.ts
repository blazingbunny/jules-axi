#!/usr/bin/env node

import { runAxiCli, AxiError } from "axi-sdk-js";
import { sessionsCommand } from "./commands/sessions.js";
import { resolveApiKey } from "./config.js";

const TOP_LEVEL_HELP = `jules-axi: Manage Jules — Google's async coding agent — from the CLI

Commands:
  sessions         List Jules sessions
  new              Create a new session (not yet implemented)
  get              Get session details (not yet implemented)
  approve          Approve a plan (not yet implemented)
  message          Send a message to a session (not yet implemented)
  activities       List activities for a session (not yet implemented)
  check-silent     Find completed sessions with no branch (not yet implemented)
  sources          List registered source repos (not yet implemented)
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

async function homeView(): Promise<string> {
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
		new: stubCommand("new"),
		get: stubCommand("get"),
		approve: stubCommand("approve"),
		message: stubCommand("message"),
		activities: stubCommand("activities"),
		"check-silent": stubCommand("check-silent"),
		sources: stubCommand("sources"),
		setup: async (args) => {
			return `error: \`setup\` is not yet implemented — coming soon.
help: The setup command will install Claude/Codex/OpenCode hooks.`;
		},
	},
});
