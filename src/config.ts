import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

interface JulesConfig {
	apiKey: string;
}

/**
 * Resolve the Jules API key. Priority:
 *   1. JULES_API_KEY env var
 *   2. ~/.config/jules-axi/config.json
 *
 * Does NOT read .jules_config.json from cwd — that file is a known
 * footgun (stale Bearer tokens silently override the API key).
 */
export function resolveApiKey(): string {
	// 1. Environment variable
	const envKey = process.env["JULES_API_KEY"];
	if (envKey) return envKey;

	// 2. Config file
	const configPath = join(homedir(), ".config", "jules-axi", "config.json");
	try {
		const raw = readFileSync(configPath, "utf-8");
		const config = JSON.parse(raw) as JulesConfig;
		if (config.apiKey) return config.apiKey;
	} catch {
		// file doesn't exist or is invalid
	}

	throw new Error(
		`No Jules API key found.\nSet JULES_API_KEY environment variable or create ${configPath} with { "apiKey": "..." }`,
	);
}
