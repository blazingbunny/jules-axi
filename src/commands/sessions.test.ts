/**
 * Unit tests for session title derivation logic.
 *
 * The Jules API returns full prompts as "titles" — all start with a
 * "You are a senior X..." identity preamble that is noise for display.
 * deriveDisplayTitle() strips this and returns the actual task description.
 *
 * Run: npx tsx src/commands/sessions.test.ts
 */

import { deriveDisplayTitle, sessionsCommand } from "./sessions.js";

interface TestCase {
	raw: string | undefined;
	expected: string;
}

const TESTS: TestCase[] = [
	// Standard Jules session — identity preamble + task
	{
		raw: "You are a senior software engineer specializing in Python and Jinja2 templating.\n\nYou are implementing part of a rules-consolidation refactor in blazingbunny/promoseo",
		expected:
			"You are implementing part of a rules-consolidation refactor in blazingbunny/prom",
	},
	// UK spelling variant (specialising)
	{
		raw: "You are a senior content writer specialising in B2B marketing and award announcements.\n\n# Write a blog post about...",
		expected: "Write a blog post about...",
	},
	// Data correctness variant — longer than 80 chars
	{
		raw: "You are a senior software engineer specializing in Python and data correctness.\n\nYou are fixing a small but real bug in blazingbunny/promoseo (a content generation pipeline for SEO award-announcement articles)",
		expected:
			"You are fixing a small but real bug in blazingbunny/promoseo (a content generati",
	},
	// No identity preamble — passes through
	{
		raw: "Fix the auth bug in the login flow",
		expected: "Fix the auth bug in the login flow",
	},
	// Undefined
	{
		raw: undefined,
		expected: "untitled",
	},
	// Empty string
	{
		raw: "",
		expected: "untitled",
	},
	// Whitespace-only lines after preamble
	{
		raw: "You are a senior software engineer specializing in testing.\n\n   \n\nNothing else",
		expected: "Nothing else",
	},
];

let passed = 0;
let failed = 0;
for (const { raw, expected } of TESTS) {
	const got = deriveDisplayTitle(raw);
	if (got === expected) {
		passed++;
	} else {
		failed++;
		console.error(`FAIL: deriveDisplayTitle(${JSON.stringify(raw)})`);
		console.error(`  expected: ${JSON.stringify(expected)}`);
		console.error(`  got:      ${JSON.stringify(got)}`);
	}
}

/**
 * sessionsCommand: zero-match branch must not suggest `--all` when the
 * user already passed --all (that suggestion would be nonsensical — they
 * already searched everywhere and still got nothing).
 */
process.env["JULES_API_KEY"] = "test-key";
const originalFetch = globalThis.fetch;
globalThis.fetch = (async () =>
	new Response(
		JSON.stringify({
			sessions: [
				{
					name: "sessions/123456789012345",
					title: "some task",
					state: "COMPLETED",
					sourceContext: { source: "sources/github/blazingbunny/jules-axi" },
				},
			],
		}),
		{ status: 200 },
	)) as typeof fetch;

const zeroMatchAll = await sessionsCommand(["--all", "--state", "NOPE"]);
if (
	typeof zeroMatchAll === "string" &&
	!zeroMatchAll.includes("sessions --all")
) {
	passed++;
} else {
	failed++;
	console.error("FAIL: sessionsCommand(['--all', '--state', 'NOPE'])");
	console.error("  expected: no '--all' suggestion in zero-match output");
	console.error(`  got:      ${JSON.stringify(zeroMatchAll)}`);
}

const zeroMatchDefault = await sessionsCommand(["--state", "NOPE"]);
if (
	typeof zeroMatchDefault === "string" &&
	zeroMatchDefault.includes("sessions --all")
) {
	passed++;
} else {
	failed++;
	console.error("FAIL: sessionsCommand(['--state', 'NOPE'])");
	console.error("  expected: '--all' suggestion present in zero-match output");
	console.error(`  got:      ${JSON.stringify(zeroMatchDefault)}`);
}

globalThis.fetch = originalFetch;

console.log(`${passed}/${TESTS.length + 2} tests passed`);
if (failed > 0) process.exit(1);
