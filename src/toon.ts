/**
 * Lightweight TOON formatter. Produces Token-Oriented Object Notation
 * arrays and key-value lines per the TOON spec.
 *
 * We inline the formatting rather than pulling a dependency since
 * the AXI output surface is small and explicit control avoids
 * over-serializing the full API payload.
 */

export interface ToonRow {
	/** Key-value pairs in order, values as strings. */
	cells: string[];
}

/**
 * Build a TOON array header like `sessions[20]{id,title,state,repo}:`
 */
export function toonHeader(
	name: string,
	count: number,
	fields: string[],
): string {
	return `${name}[${count}]{${fields.join(",")}}:`;
}

/**
 * Render a list of rows as TOON.
 * Each row: `  "cell1","cell2","cell3"`
 */
export function toonRows(rows: ToonRow[]): string {
	return rows.map((r) => `  ${r.cells.map(quoteToon).join(",")}`).join("\n");
}

/** Quote a value for TOON: only quote if it contains special chars or commas. */
function quoteToon(v: string): string {
	if (/[\s,"]/.test(v)) {
		return `"${v.replace(/"/g, '\\"')}"`;
	}
	return v;
}

export function toonKv(key: string, value: string): string {
	return `${key}: ${value}`;
}

export function toonHelp(lines: string[]): string {
	return lines.map((l, i) => `help[${i + 1}]: ${l}`).join("\n");
}
