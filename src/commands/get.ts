import { JulesApiClient } from "../api.js";
import { deriveDisplayTitle } from "./sessions.js";
import { getLocalJulesBranchSessionIds, extractRepo } from "../utils/helpers.js";

function helpText(): string {
	return `usage: jules-axi get <session-id>

Get full details for a session.

Examples:
  jules-axi get 1234567890
  jules-axi get sessions/1234567890`;
}

export async function getCommand(args: string[]): Promise<string | Record<string, unknown>> {
	const positionalArgs = args.filter(a => !a.startsWith("-"));
	const unknown = args.filter(a => a.startsWith("-") && a !== "--help");

	if (args.includes("--help")) {
		return helpText();
	}

	if (unknown.length > 0) {
		return [
			`error: unknown flag ${unknown[0]} for \`get\``,
			`Run \`jules-axi get --help\` for full reference`,
		].join("\n");
	}

	if (positionalArgs.length === 0) {
		return [
			"error: session id is required",
			`Run \`jules-axi get --help\` for full reference`,
		].join("\n");
	}

	let id = positionalArgs[0];
	if (id.startsWith("sessions/")) {
		id = id.split("/").pop() || id;
	}

	let client: JulesApiClient;
	try {
		client = new JulesApiClient();
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return `error: ${msg}`;
	}

	try {
		const session = await client.getSession(id);
		const branchIds = getLocalJulesBranchSessionIds();
		const hasBranch = session.id ? branchIds.has(session.id) : false;

		const output: Record<string, unknown> = {
			id: session.id,
			title: deriveDisplayTitle(session.title),
			state: session.state ?? "UNKNOWN",
			repo: extractRepo(session),
			"branch?": hasBranch ? "yes" : "no",
		};

		if (session.state === "COMPLETED" && !hasBranch) {
			output.warning = "Session is COMPLETED but no local git branch was found. Changes may only exist in Jules' sandbox.";
		}

		return output;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return `error: Failed to get session — ${msg}`;
	}
}
