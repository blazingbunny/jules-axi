import { readFileSync } from "node:fs";
import { JulesApiClient } from "../api.js";

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
				flags.repo = args[i + 1] && !args[i + 1].startsWith("-") ? args[++i] : "";
				break;
			case "--prompt":
				flags.prompt = args[i + 1] && !args[i + 1].startsWith("-") ? args[++i] : "";
				break;
			case "--branch":
				flags.branch = args[i + 1] && !args[i + 1].startsWith("-") ? args[++i] : "";
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
		} catch {
		}
	}

	return { flags, unknown };
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

export async function newCommand(args: string[]): Promise<string | Record<string, unknown>> {
	const { flags, unknown } = parseFlags(args);

	if (unknown.includes("--help")) {
		return helpText();
	}

	if (unknown.length > 0) {
		const validFlags = ["--repo", "--prompt", "--branch", "--require-plan-approval", "--no-require-plan-approval", "--help"];
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

	try {
		const session = await client.createSession(payload);
		const suggestAction = flags.requirePlanApproval ? "approve" : "get";
		return [
			`session created: ${session.id}`,
			`help: Run \`jules-axi ${suggestAction} ${session.id}\` to continue`
		].join("\n");
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return `error: Failed to create session — ${msg}`;
	}
}
