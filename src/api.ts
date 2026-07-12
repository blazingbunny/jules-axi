import { resolveApiKey } from "./config.js";

const BASE_URL = "https://jules.googleapis.com/v1alpha";

export interface JulesSession {
	name: string;
	id: string; // extracted from name ("sessions/<id>")
	title?: string;
	state?: string;
	sourceContext?: {
		source?: string;
	};
}

interface ListSessionsResponse {
	sessions?: JulesSession[];
	nextPageToken?: string;
}

/**
 * Minimal Jules API client. Only endpoints needed by this AXI.
 */
export class JulesApiClient {
	private apiKey: string;

	constructor() {
		this.apiKey = resolveApiKey();
	}

	private headers(): Record<string, string> {
		return {
			"Content-Type": "application/json",
			"X-Goog-Api-Key": this.apiKey,
		};
	}

	async listSessions(opts?: {
		pageSize?: number;
		pageToken?: string;
	}): Promise<ListSessionsResponse> {
		const url = new URL(`${BASE_URL}/sessions`);
		if (opts?.pageSize) url.searchParams.set("pageSize", String(opts.pageSize));
		if (opts?.pageToken) url.searchParams.set("pageToken", opts.pageToken);

		const res = await fetch(url.toString(), {
			method: "GET",
			headers: this.headers(),
		});

		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new Error(
				`Jules API returned ${res.status}: ${body.slice(0, 200)}`,
			);
		}

		const data = (await res.json()) as ListSessionsResponse;

		// Extract short ID from "sessions/<id>"
		if (data.sessions) {
			for (const s of data.sessions) {
				s.id = s.name ? s.name.split("/").pop()! : "";
			}
		}

		return data;
	}
}
