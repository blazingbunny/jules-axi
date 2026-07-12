import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { JulesApiClient } from "../api.js";

interface WatchFlags {
	stateFile?: string;
}

function parseFlags(args: string[]): {
	flags: WatchFlags;
	unknown: string[];
	positional: string[];
} {
	const flags: WatchFlags = {};
	const unknown: string[] = [];
	const positional: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		switch (arg) {
			case "--state-file":
				flags.stateFile = args[i + 1] && !args[i + 1].startsWith("-") ? args[++i] : "";
				break;
			case "--help":
				unknown.push(arg);
				break;
			default:
				if (arg.startsWith("-")) {
					unknown.push(arg);
				} else {
					positional.push(arg);
				}
				break;
		}
	}

	return { flags, unknown, positional };
}

function helpText(): string {
	return `usage: jules-axi watch <session-id> [--state-file <path>]

One-shot state-change poll for a single session.
Designed to be dropped into any polling loop or scheduler.

If the state is unchanged from the last run, it prints nothing and exits 0.
If changed, it prints the transition (old -> new) and updates the state file.
Suppresses API errors to behave nicely in background loops.

Options:
  --state-file <path>  Override the state file location (default: ~/.local/state/jules-axi/watch-<id>.state)

Examples:
  jules-axi watch 1234567890`;
}

function readState(stateFile: string): string | null {
	try {
		return readFileSync(stateFile, "utf-8").trim();
	} catch {
		return null;
	}
}

function writeState(stateFile: string, state: string): void {
	try {
		mkdirSync(dirname(stateFile), { recursive: true });
		writeFileSync(stateFile, state, "utf-8");
	} catch {
	}
}

export async function watchCommand(args: string[]): Promise<string> {
	const { flags, unknown, positional } = parseFlags(args);

	if (unknown.includes("--help")) {
		return helpText();
	}

	if (unknown.length > 0) {
		const validFlags = ["--state-file", "--help"];
		return [
			`error: unknown flag ${unknown[0]} for \`watch\``,
			`help: valid flags for \`watch\`: ${validFlags.join(", ")}`,
			`Run \`jules-axi watch --help\` for full reference`,
		].join("\n");
	}

	if (positional.length === 0) {
		return [
			"error: session id is required",
			`Run \`jules-axi watch --help\` for full reference`,
		].join("\n");
	}

	let id = positional[0];
	if (id.startsWith("sessions/")) {
		id = id.split("/").pop() || id;
	}

	const stateFile = flags.stateFile || join(homedir(), ".local", "state", "jules-axi", `watch-${id}.state`);

	let client: JulesApiClient;
	try {
		client = new JulesApiClient();
	} catch (err) {
		return "";
	}

	try {
		const session = await client.getSession(id);
		const newState = session.state || "UNKNOWN";
		const oldState = readState(stateFile);

		if (oldState === newState) {
			return "";
		}

		writeState(stateFile, newState);

		if (oldState === null) {
			return `jules session ${id}: NEW -> ${newState}`;
		} else {
			return `jules session ${id}: ${oldState} -> ${newState}`;
		}
	} catch (err) {
		return "";
	}
}
