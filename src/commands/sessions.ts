import { execSync } from "node:child_process";
import { JulesApiClient, type JulesSession } from "../api.js";
import {
	toonHeader,
	toonRows,
	toonKv,
	toonHelp,
	type ToonRow,
} from "../toon.js";

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
				flags.repo =
					args[i + 1] && !args[i + 1].startsWith("-") ? args[++i] : "";
				break;
			case "--state":
				flags.state =
					args[i + 1] && !args[i + 1].startsWith("-") ? args[++i] : "";
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

function detectCurrentRepo(): string | null {
	try {
		const out = execSync("git remote get-url origin 2>/dev/null", {
			encoding: "utf-8",
			timeout: 5000,
		});
		let url = out.trim();
		url = url.replace(/^https?:\/\/github\.com\//, "");
		url = url.replace(/^git@github\.com:/, "");
		url = url.replace(/\.git$/, "");
		url = url.replace(/\/$/, "");
		if (url.includes("/")) return url;
	} catch {
		// Not a git repo or no origin remote
	}
	return null;
}

const MAX_SESSION_PAGES = 50; // 50 * 200 = 10,000 sessions, far beyond any real account

async function fetchAllSessions(
	client: JulesApiClient,
): Promise<{ sessions: JulesSession[]; truncated: boolean }> {
	const sessions: JulesSession[] = [];
	let pageToken: string | undefined;
	let pages = 0;
	do {
		const res = await client.listSessions({ pageSize: 200, pageToken });
		sessions.push(...(res.sessions ?? []));
		pageToken = res.nextPageToken;
		pages++;
	} while (pageToken && pages < MAX_SESSION_PAGES);
	return { sessions, truncated: Boolean(pageToken) };
}

/**
 * Derive a display title from the raw Jules session title.
 * The API returns the full prompt as `title`, which starts with:
 *   "You are a senior {role} specializing in {skills}.\n\n"
 * followed by the actual task description. Strip the identity
 * preamble and return the first meaningful line of the task.
 */
export function deriveDisplayTitle(raw: string | undefined): string {
	if (!raw) return "untitled";
	// Strip the agent-identity preamble line if present.
	// Jules always opens with "You are a senior {role}.\n\n" — but the
	// role line varies in length and may use UK (specialising) or US
	// (specializing) spelling, so match greedily to the first blank line.
	const identityRe = /^You are a senior .+\n\n/;
	const body = raw.replace(identityRe, "");
	// Take first line of the task description, strip leading # markers
	const firstLine = body.split("\n").find((l) => l.trim()) ?? "";
	const cleaned = firstLine.replace(/^#{1,3}\s*/, "").trim();
	return cleaned.slice(0, 80) || "untitled";
}

function extractRepo(session: JulesSession): string {
	const source = session.sourceContext?.source ?? "";
	const prefix = "sources/github/";
	if (source.startsWith(prefix)) return source.slice(prefix.length);
	return source;
}

function helpText(): string {
	return `flags: --repo <owner/repo>, --state <STATE>, --all

Show Jules sessions. Defaults to the current git repo's sessions.
Use --all to see sessions across all repos.

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

	if (flags.repo === "") {
		return [
			"error: --repo requires a value (e.g. --repo owner/repo)",
			`Run \`jules-axi sessions --help\` for full reference`,
		].join("\n");
	}

	if (flags.state === "") {
		return [
			"error: --state requires a value (e.g. --state IN_PROGRESS)",
			`Run \`jules-axi sessions --help\` for full reference`,
		].join("\n");
	}

	// Repo filter: default to current repo for lean output, --all to skip,
	// --repo <x> to override
	const repoFilter = flags.all ? null : (flags.repo ?? detectCurrentRepo());

	const client = new JulesApiClient();

	// Filtering happens client-side, so fetch every page — a repo/state
	// filter must see the whole session set, not just the first page.
	let rawSessions: JulesSession[];
	let pagesTruncated: boolean;
	try {
		({ sessions: rawSessions, truncated: pagesTruncated } =
			await fetchAllSessions(client));
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return `error: Failed to fetch sessions — ${msg}`;
	}

	let filtered = rawSessions;
	if (repoFilter) {
		const needle = repoFilter.toLowerCase();
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
		if (repoFilter) lines.push(toonKv("repo", repoFilter));
		if (flags.state) lines.push(toonKv("state-filter", flags.state));
		lines.push(toonKv("total-available", String(total)));
		lines.push(
			toonHelp([
				"Run `jules-axi sessions --all` to see sessions across all repos",
			]),
		);
		return lines.join("\n");
	}

	// --- Aggregate ---
	lines.push(toonKv("count", `${shown} of ${total} total`));
	if (pagesTruncated) {
		lines.push(
			toonKv(
				"warning",
				`stopped after ${MAX_SESSION_PAGES} pages — older sessions may be missing`,
			),
		);
	}

	// --- TOON table ---
	const fields = ["id", "title", "state", "repo", "branch?"];
	lines.push(toonHeader("sessions", filtered.length, fields));

	const rows: ToonRow[] = filtered.map((s) => ({
		cells: [
			s.id || "?",
			deriveDisplayTitle(s.title),
			s.state ?? "UNKNOWN",
			extractRepo(s),
			s.id && branchIds.has(s.id) ? "yes" : "no",
		],
	}));
	lines.push(toonRows(rows));

	// --- Contextual next steps ---
	const suggestions: string[] = [];
	if (flags.all) {
		suggestions.push("Run `jules-axi get <id>` to view full session details");
	}
	if (!flags.all && !flags.repo) {
		suggestions.push(
			"Run `jules-axi sessions --all` to see sessions across all repos",
		);
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
