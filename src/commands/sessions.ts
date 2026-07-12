import { execSync } from "node:child_process";
import { JulesApiClient, type JulesSession } from "../api.js";

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

/**
 * Extract the repo slug from a session's sourceContext, matching exactly
 * against the `sources/github/<owner>/<repo>` convention.
 */
function extractRepo(session: JulesSession): string {
	const source = session.sourceContext?.source ?? "";
	const prefix = "sources/github/";
	if (source.startsWith(prefix)) return source.slice(prefix.length);
	return source;
}

/** Match a session against a repo filter by comparing the extracted repo slug exactly. */
function sessionMatchesRepo(
	session: JulesSession,
	repoFilter: string,
): boolean {
	return extractRepo(session).toLowerCase() === repoFilter.toLowerCase();
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

interface SessionRow {
	id: string;
	title: string;
	state: string;
	repo: string;
	"branch?": string;
}

export async function sessionsCommand(
	args: string[],
): Promise<string | Record<string, unknown>> {
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

	const repoFilter = flags.all ? null : (flags.repo ?? detectCurrentRepo());

	let client: JulesApiClient;
	try {
		client = new JulesApiClient();
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return `error: ${msg}`;
	}

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
		filtered = filtered.filter((s) => sessionMatchesRepo(s, repoFilter));
	}

	if (flags.state) {
		const needle = flags.state.toUpperCase();
		filtered = filtered.filter((s) => (s.state ?? "").toUpperCase() === needle);
	}

	const branchIds = getLocalJulesBranchSessionIds();
	const total = rawSessions.length;
	const shown = filtered.length;

	// --- Empty states (return strings for definitive messages) ---
	if (total === 0) {
		return [
			"sessions: 0 sessions found — no Jules sessions exist for this account",
			'help[1]: Run `jules-axi new --prompt "<task>" --repo <owner/repo>` to create one',
		].join("\n");
	}

	if (shown === 0) {
		const lines: string[] = ["sessions: 0 matching sessions"];
		if (repoFilter) lines.push(`repo: ${repoFilter}`);
		if (flags.state) lines.push(`state-filter: ${flags.state}`);
		lines.push(`total-available: ${String(total)}`);
		if (pagesTruncated) {
			lines.push(
				`warning: stopped after ${MAX_SESSION_PAGES} pages — older sessions may be missing`,
			);
		}
		if (!flags.all && !flags.repo) {
			lines.push(
				"help[1]: Run `jules-axi sessions --all` to see sessions across all repos",
			);
		}
		return lines.join("\n");
	}

	// --- Normal output: structured object rendered by @toon-format/toon ---
	const rows: SessionRow[] = filtered.map((s) => ({
		id: s.id || "?",
		title: deriveDisplayTitle(s.title),
		state: s.state ?? "UNKNOWN",
		repo: extractRepo(s),
		"branch?": s.id && branchIds.has(s.id) ? "yes" : "no",
	}));

	const output: Record<string, unknown> = {
		count: `${shown} of ${total} total`,
		sessions: rows,
	};

	if (pagesTruncated) {
		output.warning = `stopped after ${MAX_SESSION_PAGES} pages — older sessions may be missing`;
	}

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
	output.help = suggestions;

	return output;
}
