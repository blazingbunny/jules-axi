import { JulesApiClient } from "../api.js";

interface ActivitiesFlags {
	full: boolean;
}

function parseFlags(args: string[]): {
	flags: ActivitiesFlags;
	unknown: string[];
	positional: string[];
} {
	const flags: ActivitiesFlags = { full: false };
	const unknown: string[] = [];
	const positional: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		switch (arg) {
			case "--full":
				flags.full = true;
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
	return `usage: jules-axi activities <session-id> [--full]

List activities for a session.

Options:
  --full  Show all activities (default: truncate to latest 15)

Examples:
  jules-axi activities 1234567890
  jules-axi activities 1234567890 --full`;
}

function summarizeActivity(activity: any): string {
	if (!activity) return "unknown";

	if (activity.agentMessaged?.message) {
		const text = activity.agentMessaged.message.replace(/\\n/g, " ");
		return text.length > 100 ? text.slice(0, 97) + "..." : text;
	}
	if (activity.fileEdited?.path) return activity.fileEdited.path;
	if (activity.fileCreated?.path) return activity.fileCreated.path;
	if (activity.commandRun?.command) return activity.commandRun.command;
	if (activity.planGenerated?.title) return activity.planGenerated.title;
	if (activity.planGenerated) return "plan generated";
	if (activity.planApproved) return "plan approved";
	if (activity.progressUpdated?.title) return activity.progressUpdated.title;
	if (activity.progressUpdated?.description) return activity.progressUpdated.description;
	if (activity.progressUpdated) return "progress updated";
	if (activity.artifacts) return "artifact attached";
	if (activity.sessionCompleted) return "session completed";
	if (activity.planCreated) return "plan created";

	// Default to type if identifiable
	if (activity.agentMessaged) return "agent messaged";
	if (activity.fileEdited) return "file edited";
	if (activity.fileCreated) return "file created";
	if (activity.commandRun) return "command run";

	const type = getActivityType(activity);
	return `unknown activity: ${type}`;
}

function getActivityType(activity: any): string {
	if (!activity) return "unknown";
	if (activity.planCreated) return "planCreated";
	if (activity.planGenerated) return "planGenerated";
	if (activity.planApproved) return "planApproved";
	if (activity.progressUpdated) return "progressUpdated";
	if (activity.artifacts) return "artifacts";
	if (activity.sessionCompleted) return "sessionCompleted";
	if (activity.agentMessaged) return "agentMessaged";
	if (activity.fileCreated) return "fileCreated";
	if (activity.fileEdited) return "fileEdited";
	if (activity.commandRun) return "commandRun";

	// fallback to finding the first defined key
	const keys = Object.keys(activity).filter(k => k !== "name" && k !== "createTime");
	return keys[0] || "unknown";
}

export async function activitiesCommand(args: string[]): Promise<string | Record<string, unknown>> {
	const { flags, unknown, positional } = parseFlags(args);

	if (unknown.includes("--help")) {
		return helpText();
	}

	if (unknown.length > 0) {
		const validFlags = ["--full", "--help"];
		return [
			`error: unknown flag ${unknown[0]} for \`activities\``,
			`help: valid flags for \`activities\`: ${validFlags.join(", ")}`,
			`Run \`jules-axi activities --help\` for full reference`,
		].join("\n");
	}

	if (positional.length === 0) {
		return [
			"error: session id is required",
			`Run \`jules-axi activities --help\` for full reference`,
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
		const activities = await client.listActivities(id);
		const total = activities.length;

		if (total === 0) {
			return `activities: 0 activities found for session ${id}`;
		}

		let displayActivities = activities;
		const MAX_DISPLAY = 15;
		let truncated = false;

		if (!flags.full && total > MAX_DISPLAY) {
			displayActivities = activities.slice(total - MAX_DISPLAY); // Last 15
			truncated = true;
		}

		const rows = displayActivities.map(a => ({
			type: getActivityType(a),
			summary: summarizeActivity(a),
		}));

		const output: Record<string, unknown> = {
			count: `${displayActivities.length} of ${total} total`,
			activities: rows,
		};

		if (truncated) {
			output.help = [
				`Run \`jules-axi activities ${id} --full\` to see all ${total} activities`
			];
		}

		return output;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return `error: Failed to list activities — ${msg}`;
	}
}
