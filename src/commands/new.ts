import { readFileSync } from "node:fs";
import { JulesApiClient } from "../api.js";
import { fetchAllSessions } from "./sessions.js";

interface NewFlags {
	repo: string;
	prompt: string;
	branch?: string;
	requirePlanApproval: boolean;
}

function parseFlags(args: string[]): {
	flags: NewFlags;
	unknown: string[];
} {
	const flags: NewFlags = { repo: "", prompt: "", requirePlanApproval: true };
	const unknown: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		switch (arg) {
			case "--repo":
				flags.repo =
					args[i + 1] && !args[i + 1].startsWith("-") ? args[++i] : "";
				break;
			case "--prompt":
				flags.prompt =
					args[i + 1] && !args[i + 1].startsWith("-") ? args[++i] : "";
				break;
			case "--branch":
				flags.branch =
					args[i + 1] && !args[i + 1].startsWith("-") ? args[++i] : "";
				break;
			case "--require-plan-approval":
				flags.requirePlanApproval = true;
				break;
			case "--no-require-plan-approval":
				flags.requirePlanApproval = false;
				break;
			case "--help":
				unknown.push(arg);
				break;
			default:
				if (arg.startsWith("-")) unknown.push(arg);
				break;
		}
	}

	if (!flags.prompt && !process.stdin.isTTY) {
		try {
			flags.prompt = readFileSync(process.stdin.fd, "utf-8").trim();
		} catch {}
	}

	return { flags, unknown };
}

// Non-terminal states — sessions still consuming a concurrent task slot.
const NON_TERMINAL_STATES = new Set([
	"QUEUED",
	"PLANNING",
	"AWAITING_PLAN_APPROVAL",
	"AWAITING_USER_FEEDBACK",
	"IN_PROGRESS",
	"PAUSED",
]);

const FREE_TIER_MAX_24H = 15;
const FREE_TIER_MAX_CONCURRENT = 3;

/**
 * Best-effort pre-check against free-tier limits.
 * Session state lags real completion by 35+ min, so this can overcount.
 * The real safety net is the API error handler in createSession.
 */
async function checkFreeTierLimit(
	client: JulesApiClient,
): Promise<string | null> {
	const { sessions } = await fetchAllSessions(client);
	const now = new Date();
	const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

	let recentCreations = 0;
	let concurrent = 0;

	for (const s of sessions) {
		if (s.createTime) {
			const created = new Date(s.createTime);
			if (created >= cutoff) recentCreations++;
		}
		if (s.state && NON_TERMINAL_STATES.has(s.state.toUpperCase())) {
			concurrent++;
		}
	}

	if (recentCreations >= FREE_TIER_MAX_24H) {
		return `error: free-tier limit reached (${recentCreations}/${FREE_TIER_MAX_24H} sessions created in trailing 24h) — wait for the oldest to age out or upgrade your plan`;
	}
	if (concurrent >= FREE_TIER_MAX_CONCURRENT) {
		return `error: free-tier limit reached (${concurrent}/${FREE_TIER_MAX_CONCURRENT} concurrent non-terminal sessions) — wait for a session to finish or upgrade your plan`;
	}

	return null;
}

function helpText(): string {
	return `flags: --repo <owner/repo>, --prompt <text>, [--branch <name>], [--require-plan-approval]

Create a new Jules session.

Options:
  --repo <owner/repo>      (Required) The repository to work on
  --prompt <text>          (Required) The task description (or pipe via stdin)
  --branch <name>          (Optional) The starting branch. Defaults to repo default branch.
  --require-plan-approval  (Optional) Wait for manual plan approval (default: true)
  --no-require-plan-approval Disable plan approval

Examples:
  jules-axi new --repo blazingbunny/jules-axi --prompt "Add pagination support"
  cat task.md | jules-axi new --repo blazingbunny/jules-axi`;
}

export async function newCommand(
	args: string[],
): Promise<string | Record<string, unknown>> {
	const { flags, unknown } = parseFlags(args);

	if (unknown.includes("--help")) {
		return helpText();
	}

	if (unknown.length > 0) {
		const validFlags = [
			"--repo",
			"--prompt",
			"--branch",
			"--require-plan-approval",
			"--no-require-plan-approval",
			"--help",
		];
		return [
			`error: unknown flag ${unknown[0]} for \`new\``,
			`help: valid flags for \`new\`: ${validFlags.join(", ")}`,
			`Run \`jules-axi new --help\` for full reference`,
		].join("\n");
	}

	if (!flags.repo) {
		return [
			"error: --repo is required",
			`Run \`jules-axi new --help\` for full reference`,
		].join("\n");
	}

	if (!flags.prompt) {
		return [
			"error: --prompt is required (or pipe via stdin)",
			`Run \`jules-axi new --help\` for full reference`,
		].join("\n");
	}

	let source = flags.repo;
	if (!source.startsWith("sources/")) {
		source = `sources/github/${source}`;
	}

	const payload: any = {
		title: flags.prompt.split("\n")[0].slice(0, 100),
		prompt: flags.prompt,
		automationMode: "AUTO_CREATE_PR",
		requirePlanApproval: flags.requirePlanApproval,
		sourceContext: {
			source: source,
		},
	};

	if (flags.branch) {
		payload.sourceContext.githubRepoContext = { startingBranch: flags.branch };
	}

	let client: JulesApiClient;
	try {
		client = new JulesApiClient();
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return `error: ${msg}`;
	}

	// Best-effort free-tier pre-check (state lags; API error handler is the real safety net)
	let rateLimitError: string | null = null;
	try {
		rateLimitError = await checkFreeTierLimit(client);
	} catch {
		// fail open — pre-check is best-effort, createSession's error handler is the real safety net
	}
	if (rateLimitError) return rateLimitError;

	try {
		const session = await client.createSession(payload);
		const suggestAction = flags.requirePlanApproval ? "approve" : "get";
		return [
			`session created: ${session.id}`,
			`help: Run \`jules-axi ${suggestAction} ${session.id}\` to continue`,
		].join("\n");
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		// Surface quota errors clearly — the pre-check can miss these because state lags
		if (
			msg.includes("429") ||
			msg.toLowerCase().includes("quota") ||
			msg.toLowerCase().includes("limit")
		) {
			return `error: Free-tier limit reached — the Jules API rejected this request. Wait for a pending session to finish or upgrade your plan.\ndetail: ${msg}`;
		}
		return `error: Failed to create session — ${msg}`;
	}
}
