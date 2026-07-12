import { resolveApiKey } from "./config.js";

const BASE_URL = "https://jules.googleapis.com/v1alpha";

export interface JulesSession {
	name: string;
	id: string; // extracted from name ("sessions/<id>")
	title?: string;
	state?: string;
	createTime?: string;
	updateTime?: string;
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

	private async request(path: string, init?: RequestInit): Promise<any> {
		const res = await fetch(`${BASE_URL}${path}`, {
			...init,
			headers: this.headers(),
		});

		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new Error(
				`Jules API returned ${res.status}: ${body.slice(0, 200)}`,
			);
		}

		const text = await res.text();
		return text ? JSON.parse(text) : undefined;
	}

	async getSession(id: string): Promise<JulesSession> {
		const session = (await this.request(`/sessions/${id}`)) as JulesSession;
		session.id = session.name ? session.name.split("/").pop()! : "";
		return session;
	}

	async createSession(payload: any): Promise<JulesSession> {
		const session = (await this.request("/sessions", {
			method: "POST",
			body: JSON.stringify(payload),
		})) as JulesSession;
		session.id = session.name ? session.name.split("/").pop()! : "";
		return session;
	}

	async approvePlan(id: string): Promise<void> {
		await this.request(`/sessions/${id}:approvePlan`, { method: "POST" });
	}

	async sendMessage(id: string, text: string): Promise<void> {
		await this.request(`/sessions/${id}:sendMessage`, {
			method: "POST",
			body: JSON.stringify({ message: text }),
		});
	}

	async listActivities(id: string): Promise<any[]> {
		const data = await this.request(`/sessions/${id}/activities`);
		return data.activities || [];
	}

	async listSources(): Promise<any[]> {
		const data = await this.request("/sources");
		return data.sources || [];
	}

	async listSessions(opts?: {
		pageSize?: number;
		pageToken?: string;
	}): Promise<ListSessionsResponse> {
		const params = new URLSearchParams();
		if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));
		if (opts?.pageToken) params.set("pageToken", opts.pageToken);
		const query = params.toString();

		const data = (await this.request(
			`/sessions${query ? `?${query}` : ""}`,
		)) as ListSessionsResponse;

		// Extract short ID from "sessions/<id>"
		if (data.sessions) {
			for (const s of data.sessions) {
				s.id = s.name ? s.name.split("/").pop()! : "";
			}
		}

		return data;
	}
}
