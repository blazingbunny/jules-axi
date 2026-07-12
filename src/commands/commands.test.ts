import { newCommand } from "./new.js";
import { getCommand } from "./get.js";
import { watchCommand } from "./watch.js";

// Basic flag parsing and validation testing

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => Promise<void>) {
	try {
		await fn();
		passed++;
	} catch (e) {
		failed++;
		console.error(`FAIL: ${name}`);
		console.error(e);
	}
}

async function testNewCommandValidation() {
	const res = await newCommand([]);
	if (typeof res !== "string" || !res.includes("error: --repo is required")) {
		throw new Error(`Expected '--repo is required' error, got: ${JSON.stringify(res)}`);
	}
}

async function testGetCommandValidation() {
	const res = await getCommand([]);
	if (typeof res !== "string" || !res.includes("error: session id is required")) {
		throw new Error(`Expected 'session id is required' error, got: ${JSON.stringify(res)}`);
	}
}

await runTest("newCommand requires repo", testNewCommandValidation);
await runTest("getCommand requires id", testGetCommandValidation);

console.log(`${passed}/${passed + failed} tests passed`);
if (failed > 0) process.exit(1);
