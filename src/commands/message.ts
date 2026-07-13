import { JulesApiClient } from "../api.js";

interface MessageFlags {
	text: string;
}

function parseFlags(args: string[]): {
	flags: MessageFlags;
	unknown: string[];
	positional: string[];
} {
	const flags: MessageFlags = { text: "" };
	const unknown: string[] = [];
	const positional: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		switch (arg) {
			case "--text":
				flags.text = args[i + 1] && !args[i + 1].startsWith("-") ? args[++i] : "";
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
	return `usage: jules-axi message <session-id> --text "<message>"

Send a message to a session.

Options:
  --text <message>  (Required) The message text to send

Examples:
  jules-axi message 1234567890 --text "Please add tests"`;
}

export async function messageCommand(args: string[]): Promise<string | Record<string, unknown>> {
	const { flags, unknown, positional } = parseFlags(args);

	if (unknown.includes("--help")) {
		return helpText();
	}

	if (unknown.length > 0) {
		const validFlags = ["--text", "--help"];
		return [
			`error: unknown flag ${unknown[0]} for \`message\``,
			`help: valid flags for \`message\`: ${validFlags.join(", ")}`,
			`Run \`jules-axi message --help\` for full reference`,
		].join("\n");
	}

	if (positional.length === 0) {
		return [
			"error: session id is required",
			`Run \`jules-axi message --help\` for full reference`,
		].join("\n");
	}

	if (!flags.text) {
		return [
			"error: --text is required",
			`Run \`jules-axi message --help\` for full reference`,
		].join("\n");
	}

	let id = positional[0];
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
		await client.sendMessage(id, flags.text);
		return `message sent to session ${id}`;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return `error: Failed to send message — ${msg}`;
	}
}
