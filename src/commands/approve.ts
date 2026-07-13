import { JulesApiClient } from "../api.js";

function helpText(): string {
	return `usage: jules-axi approve <session-id>

Approve a pending plan for a session.

Examples:
  jules-axi approve 1234567890`;
}

export async function approveCommand(args: string[]): Promise<string | Record<string, unknown>> {
	const positionalArgs = args.filter(a => !a.startsWith("-"));
	const unknown = args.filter(a => a.startsWith("-") && a !== "--help");

	if (args.includes("--help")) {
		return helpText();
	}

	if (unknown.length > 0) {
		return [
			`error: unknown flag ${unknown[0]} for \`approve\``,
			`Run \`jules-axi approve --help\` for full reference`,
		].join("\n");
	}

	if (positionalArgs.length === 0) {
		return [
			"error: session id is required",
			`Run \`jules-axi approve --help\` for full reference`,
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
		if (session.state !== "AWAITING_PLAN_APPROVAL") {
			return `approve: session ${id} is not awaiting plan approval (current state: ${session.state}) — nothing to do`;
		}

		await client.approvePlan(id);
		return `approve: session ${id} plan approved`;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return `error: Failed to approve plan — ${msg}`;
	}
}
