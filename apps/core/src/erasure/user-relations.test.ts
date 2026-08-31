import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	ERASED_USER_RELATIONS,
	RETAINED_USER_RELATIONS,
	UNLINKED_EMAIL_SITES,
} from "./user-relations";

/**
 * The closed-world guard.
 *
 * The schema is read as TEXT, never through the generated Prisma client. The
 * client lives in `src/.generated`, is gitignored, and is a build artifact: a
 * stale one describes yesterday's schema and would pass on exactly the change
 * this file exists to catch.
 */

const MODELS_DIR = join(process.cwd(), "prisma", "models");

/** Types Prisma resolves itself. Anything else in a field position is a relation. */
const PRISMA_SCALARS = new Set([
	"String",
	"Boolean",
	"Int",
	"BigInt",
	"Float",
	"Decimal",
	"DateTime",
	"Json",
	"Bytes",
	"Unsupported",
]);

function readModelsSource(): string {
	// EVERY model file, concatenated — never a hand-kept list. A model moved
	// between files changes nothing here, and a new file is covered on the day it
	// is added rather than the day someone remembers to list it.
	const files = readdirSync(MODELS_DIR)
		.filter((f) => f.endsWith(".prisma"))
		.sort();
	expect(files.length, `no .prisma files under ${MODELS_DIR}`).toBeGreaterThan(0);
	return files.map((f) => readFileSync(join(MODELS_DIR, f), "utf8")).join("\n");
}

/** The body of `model <name> { ... }`, brace-matched rather than regex-greedy. */
function modelBody(source: string, modelName: string): string {
	const header = new RegExp(`^model\\s+${modelName}\\s*\\{`, "m");
	const start = source.search(header);
	expect(start, `model ${modelName} not found in prisma/models`).toBeGreaterThanOrEqual(0);

	const open = source.indexOf("{", start);
	let depth = 0;
	for (let i = open; i < source.length; i++) {
		if (source[i] === "{") depth++;
		if (source[i] === "}") {
			depth--;
			if (depth === 0) return source.slice(open + 1, i);
		}
	}
	throw new Error(`unbalanced braces in model ${modelName}`);
}

/** Field name → base type, for every field in a model body. */
function fields(body: string): Array<{ name: string; type: string }> {
	const out: Array<{ name: string; type: string }> = [];
	for (const raw of body.split("\n")) {
		const line = raw.trim();
		if (line.length === 0) continue;
		if (line.startsWith("//") || line.startsWith("@@")) continue;
		const m = /^(\w+)\s+(\w+)(\[\])?\??/.exec(line);
		if (!m) continue;
		out.push({ name: m[1], type: m[2] });
	}
	return out;
}

function enumNames(source: string): Set<string> {
	return new Set(Array.from(source.matchAll(/^enum\s+(\w+)\s*\{/gm), (m) => m[1]));
}

function userRelationFields(): string[] {
	const source = readModelsSource();
	const enums = enumNames(source);
	return fields(modelBody(source, "User"))
		.filter((f) => !PRISMA_SCALARS.has(f.type) && !enums.has(f.type))
		.map((f) => f.name);
}

describe("User relations are classified for account closure", () => {
	const erased = ERASED_USER_RELATIONS.map((r) => r.relation);
	const retained = RETAINED_USER_RELATIONS.map((r) => r.relation);

	it("finds the relations it is meant to be guarding", () => {
		// Non-vacuity. A parser that silently matches nothing would make every
		// other assertion in this file pass forever.
		const found = userRelationFields();
		expect(found.length).toBeGreaterThanOrEqual(8);
		expect(found).toContain("organizationMemberships");
		expect(found).toContain("userSessions");
	});

	it("classifies every relation on User as erased or retained", () => {
		const classified = new Set([...erased, ...retained]);
		const unclassified = userRelationFields().filter((f) => !classified.has(f));

		expect(
			unclassified,
			`New relation(s) on User: ${unclassified.join(", ")}. Closing an account ` +
				"must visit or deliberately skip every one. Add each to " +
				"ERASED_USER_RELATIONS (with the model and its user-id column) or to " +
				"RETAINED_USER_RELATIONS (with the grounds for keeping it).",
		).toEqual([]);
	});

	it("classifies nothing that is not a relation on User", () => {
		const actual = new Set(userRelationFields());
		const stale = [...erased, ...retained].filter((r) => !actual.has(r));

		expect(
			stale,
			`Classified but no longer on User: ${stale.join(", ")}. A stale entry ` +
				"makes the closed world look complete while covering a relation that " +
				"no longer exists.",
		).toEqual([]);
	});

	it("puts each relation in exactly one list", () => {
		const both = erased.filter((r) => retained.includes(r));
		expect(both, `In both lists: ${both.join(", ")}`).toEqual([]);
	});

	it("deletes by a column that still exists on the model", () => {
		const source = readModelsSource();
		for (const entry of ERASED_USER_RELATIONS) {
			const names = fields(modelBody(source, entry.model)).map((f) => f.name);
			expect(
				names,
				`${entry.model} has no ${entry.userIdField} column — the closure would ` +
					"delete nothing and report success.",
			).toContain(entry.userIdField);
		}
	});

	it("states grounds for everything it keeps", () => {
		for (const entry of RETAINED_USER_RELATIONS) {
			expect(entry.grounds.length, `${entry.relation} has no grounds`).toBeGreaterThan(40);
		}
	});
});

describe("addresses that no relation walk reaches", () => {
	it("still holds an email in exactly the columns we handle by hand", () => {
		// The check that keeps UNLINKED_EMAIL_SITES honest: if a new model gains
		// an `email` column, it is personal data with no path from `User`, and the
		// closure will not find it.
		const source = readModelsSource();
		const owners = Array.from(
			source.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm),
			(m) => ({ model: m[1], body: m[2] }),
		)
			.filter(({ body }) => fields(body).some((f) => f.name.toLowerCase() === "email"))
			.map(({ model }) => model);

		expect(
			owners.sort(),
			"A model gained an `email` column. If it has no path from User, add it " +
				"to UNLINKED_EMAIL_SITES and handle it in ErasureRepository.",
		).toEqual(["OrganizationInvitation", "User"]);
	});

	it("records the free-text sites the personal organization bakes an address into", () => {
		expect(UNLINKED_EMAIL_SITES).toContain("OrganizationInvitation.email");
		expect(UNLINKED_EMAIL_SITES).toContain("Organization.description");
		expect(UNLINKED_EMAIL_SITES).toContain("Project.description");
	});
});
