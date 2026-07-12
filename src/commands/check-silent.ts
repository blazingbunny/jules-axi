import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { JulesApiClient } from "../api.js";
import { fetchAllSessions, sessionMatchesRepo, detectCurrentRepo } from "./sessions.js";
import { getLocalJulesBranchSessionIds, extractRepo } from "../utils/helpers.js";

interface CheckSilentFlags {
	repo?: string;
	stateFile?: string;
	noState: boolean;
}

function parseFlags(args: string[]): {
	flags: CheckSilentFlags;
	unknown: string[];
} {
	const flags: CheckSilentFlags = { noState: false };
	const unknown: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		switch (arg) {
			case "--repo":
				flags.repo = args[i + 1] && !args[i + 1].startsWith("-") ? args[++i] : "";
				break;
			case "--state-file":
				flags.stateFile = args[i + 1] && !args[i + 1].startsWith("-") ? args[++i] : "";
				break;
			case "--no-state":
				flags.noState = true;
				break;
			case "--help":
				unknown.push(arg);
				break;
			default:
				if (arg.startsWith("-")) unknown.push(arg);
				break;
		}
	}

	return { flags, unknown };
}

function helpText(): string {
	return `flags: [--repo <owner/repo>], [--state-file <path>], [--no-state]

Find COMPLETED sessions that lack a corresponding local git branch.
These are "silent failures" where Jules completed the task but nothing was pushed.

By default, this command is poll-friendly: it maintains a state file to remember
which sessions it has already reported, and exits with no output if there are no NEW silent failures.

Options:
  --repo <owner/repo>   Filter by repository
  --state-file <path>   Override the default state file location (~/.local/state/jules-axi/check-silent-seen.json)
  --no-state            Disable deduplication and print all current silent failures

Examples:
  jules-axi check-silent
  jules-axi check-silent --no-state
  jules-axi check-silent --repo blazingbunny/jules-axi`;
}

function loadSeen(stateFile: string): Set<string> {
	try {
		const raw = readFileSync(stateFile, "utf-8");
		const data = JSON.parse(raw);
		if (Array.isArray(data)) return new Set(data);
	} catch {
	}
	return new Set();
}

function saveSeen(stateFile: string, seen: Set<string>): void {
	try {
		mkdirSync(dirname(stateFile), { recursive: true });
		writeFileSync(stateFile, JSON.stringify(Array.from(seen)), "utf-8");
	} catch (err) {
		console.error(`warning: failed to save state to ${stateFile}`);
	}
}

export async function checkSilentCommand(args: string[]): Promise<string | Record<string, unknown>> {
	const { flags, unknown } = parseFlags(args);

	if (unknown.includes("--help")) {
		return helpText();
	}

	if (unknown.length > 0) {
		const validFlags = ["--repo", "--state-file", "--no-state", "--help"];
		return [
			`error: unknown flag ${unknown[0]} for \`check-silent\``,
			`help: valid flags for \`check-silent\`: ${validFlags.join(", ")}`,
			`Run \`jules-axi check-silent --help\` for full reference`,
		].join("\n");
	}

	if (flags.repo === "") {
		return [
			"error: --repo requires a value (e.g. --repo owner/repo)",
			`Run \`jules-axi check-silent --help\` for full reference`,
		].join("\n");
	}

	let client: JulesApiClient;
	try {
		client = new JulesApiClient();
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return `error: ${msg}`;
	}

	const repoFilter = flags.repo ?? detectCurrentRepo();
	
	let rawSessions;
	try {
		({ sessions: rawSessions } = await fetchAllSessions(client));
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return `error: Failed to fetch sessions — ${msg}`;
	}

	let filtered = rawSessions.filter(s => s.state === "COMPLETED");
	if (repoFilter) {
		filtered = filtered.filter(s => sessionMatchesRepo(s, repoFilter));
	}

	const branchIds = getLocalJulesBranchSessionIds();
	
	const silentFailures = filtered.filter(s => s.id && !branchIds.has(s.id));

	if (flags.noState) {
		if (silentFailures.length === 0) {
			return "check-silent: 0 silent failures found";
		}
		return {
			count: `${silentFailures.length} silent failures`,
			sessions: silentFailures.map(s => ({
				id: s.id,
				repo: extractRepo(s),
				title: s.title ? s.title.slice(0, 50) : "untitled"
			}))
		};
	}

	const stateFile = flags.stateFile || join(homedir(), ".local", "state", "jules-axi", "check-silent-seen.json");
	const seen = loadSeen(stateFile);
	
	const newFailures = silentFailures.filter(s => s.id && !seen.has(s.id));
	
	if (newFailures.length === 0) {
		return "";
	}

	for (const s of newFailures) {
		if (s.id) seen.add(s.id);
	}
	saveSeen(stateFile, seen);

	return {
		count: `${newFailures.length} NEW silent failures`,
		sessions: newFailures.map(s => ({
			id: s.id,
			repo: extractRepo(s),
			title: s.title ? s.title.slice(0, 50) : "untitled"
		}))
	};
}
