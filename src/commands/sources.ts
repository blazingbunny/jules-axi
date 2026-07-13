import { JulesApiClient } from "../api.js";

function helpText(): string {
	return `usage: jules-axi sources

List registered source repos.`;
}

export async function sourcesCommand(args: string[]): Promise<string | Record<string, unknown>> {
	if (args.includes("--help")) {
		return helpText();
	}

	const unknown = args.filter(a => a.startsWith("-"));
	if (unknown.length > 0) {
		return [
			`error: unknown flag ${unknown[0]} for \`sources\``,
			`Run \`jules-axi sources --help\` for full reference`,
		].join("\n");
	}

	let client: JulesApiClient;
	try {
		client = new JulesApiClient();
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return `error: ${msg}`;
	}

	try {
		const sources = await client.listSources();
		if (sources.length === 0) {
			return "sources: 0 registered sources found";
		}

		const rows = sources.map(s => ({
			name: s.name || "?",
			status: s.status || "UNKNOWN",
		}));

		return {
			count: `${sources.length} total`,
			sources: rows,
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return `error: Failed to list sources — ${msg}`;
	}
}
