import { execSync } from "node:child_process";
import { JulesApiClient, type JulesSession } from "../api.js";
import {
	toonHeader,
	toonRows,
	toonKv,
	toonHelp,
	type ToonRow,
} from "../toon.js";

const DEFAULT_LIMIT = 20;

interface SessionsFlags {
	repo?: string;
	state?: string;
	all: boolean;
}

function parseFlags(args: string[]): {
	flags: SessionsFlags;
	unknown: string[];
} {
	const flags: SessionsFlags = { all: false };
	const unknown: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		switch (arg) {
			case "--repo":
				flags.repo = args[++i] ?? "";
				break;
			case "--state":
				flags.state = args[++i] ?? "";
				break;
			case "--all":
				flags.all = true;
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

function getLocalJulesBranchSessionIds(): Set<string> {
	try {
		const out = execSync("git branch --all 2>/dev/null", {
			encoding: "utf-8",
			timeout: 5000,
		});
		const ids = new Set<string>();
		const re = /(\d{15,})/g;
		for (const line of out.split("\n")) {
			let m: RegExpExecArray | null;
			while ((m = re.exec(line)) !== null) {
				ids.add(m[1]);
			}
		}
		return ids;
	} catch {
		return new Set();
	}
}

function extractRepo(session: JulesSession): string {
	const source = session.sourceContext?.source ?? "";
	const prefix = "sources/github/";
	if (source.startsWith(prefix)) return source.slice(prefix.length);
	return source;
}

function helpText(): string {
	return `flags: --repo <owner/repo>, --state <STATE>, --all

Show Jules sessions. Defaults to last ${DEFAULT_LIMIT} — use --all for everything.

Filter examples:
  jules-axi sessions --repo blazingbunny/jules-axi
  jules-axi sessions --state IN_PROGRESS
  jules-axi sessions --all --state COMPLETED`;
}

export async function sessionsCommand(args: string[]): Promise<string> {
	const { flags, unknown } = parseFlags(args);

	if (unknown.includes("--help")) {
		return helpText();
	}

	if (unknown.length > 0) {
		const validFlags = ["--repo", "--state", "--all", "--help"];
		return [
			`error: unknown flag ${unknown[0]} for \`sessions\``,
			`help: valid flags for \`sessions\`: ${validFlags.join(", ")}`,
			`Run \`jules-axi sessions --help\` for full reference`,
		].join("\n");
	}

	const client = new JulesApiClient();

	let rawSessions: JulesSession[];
	try {
		const res = await client.listSessions({
			pageSize: flags.all ? 200 : DEFAULT_LIMIT,
		});
		rawSessions = res.sessions ?? [];
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return `error: Failed to fetch sessions — ${msg}`;
	}

	// Client-side repo filter
	let filtered = rawSessions;
	if (flags.repo) {
		const needle = flags.repo.toLowerCase();
		filtered = filtered.filter((s) =>
			(s.sourceContext?.source ?? "").toLowerCase().includes(needle),
		);
	}

	// Client-side state filter
	if (flags.state) {
		const needle = flags.state.toUpperCase();
		filtered = filtered.filter((s) => (s.state ?? "").toUpperCase() === needle);
	}

	// Git reconciliation
	const branchIds = getLocalJulesBranchSessionIds();

	const total = rawSessions.length;
	const shown = filtered.length;
	const truncated = !flags.all && total > DEFAULT_LIMIT && shown > 0;

	const lines: string[] = [];

	// --- Empty states ---
	if (total === 0) {
		lines.push(
			"sessions: 0 sessions found — no Jules sessions exist for this account",
		);
		lines.push(
			toonHelp([
				'Run `jules-axi new --prompt "<task>" --repo <owner/repo>` to create one',
			]),
		);
		return lines.join("\n");
	}

	if (shown === 0) {
		lines.push("sessions: 0 matching sessions");
		if (flags.repo) lines.push(toonKv("repo-filter", flags.repo));
		if (flags.state) lines.push(toonKv("state-filter", flags.state));
		lines.push(toonKv("total-available", String(total)));
		return lines.join("\n");
	}

	// --- Aggregate ---
	lines.push(toonKv("count", `${shown} of ${total} total`));

	// --- TOON table ---
	const fields = ["id", "title", "state", "repo", "branch?"];
	lines.push(toonHeader("sessions", filtered.length, fields));

	const rows: ToonRow[] = filtered.map((s) => ({
		cells: [
			s.id || "?",
			(s.title ?? "").split("\n")[0].slice(0, 80) || "untitled",
			s.state ?? "UNKNOWN",
			extractRepo(s),
			s.id && branchIds.has(s.id) ? "yes" : "no",
		],
	}));
	lines.push(toonRows(rows));

	// --- Truncation hint ---
	if (truncated) {
		lines.push(
			toonHelp([
				`Showing last ${DEFAULT_LIMIT} of ${total} sessions — run \`jules-axi sessions --all\` for full list`,
			]),
		);
	}

	// --- Contextual next steps ---
	const suggestions: string[] = [];
	if (truncated || flags.all) {
		suggestions.push("Run `jules-axi sessions <id>` to view full details");
	}
	suggestions.push(
		"Run `jules-axi sessions --state AWAITING_USER_FEEDBACK` to find sessions that need input",
	);
	suggestions.push(
		"Run `jules-axi sessions --state COMPLETED` to find finished sessions",
	);
	lines.push(toonHelp(suggestions));

	return lines.join("\n");
}
