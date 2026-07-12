import { execSync } from "node:child_process";
import { JulesSession } from "../api.js";

export function getLocalJulesBranchSessionIds(): Set<string> {
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

export function extractRepo(session: JulesSession): string {
	const source = session.sourceContext?.source ?? "";
	const prefix = "sources/github/";
	if (source.startsWith(prefix)) return source.slice(prefix.length);
	return source;
}
