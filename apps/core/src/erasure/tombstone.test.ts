import { describe, it, expect } from "vitest";
import {
	TOMBSTONE_NAME,
	isTombstoneEmail,
	redactEmailInText,
	tombstoneAuthIdFor,
	tombstoneEmailFor,
} from "./tombstone";

describe("tombstone values", () => {
	it("derives a distinct email per user, in an undeliverable domain", () => {
		expect(tombstoneEmailFor(7)).toBe("erased-7@erased.invalid");
		expect(tombstoneEmailFor(8)).not.toBe(tombstoneEmailFor(7));
		// `User.email` is @unique — two erased users must never collide.
		expect(tombstoneEmailFor(7).endsWith("@erased.invalid")).toBe(true);
	});

	it("derives a distinct authID per user", () => {
		// The reason this is derived rather than a shared constant:
		// getUserByAuthID is a findFirst over a column with no unique index, so a
		// shared value would make one erased user resolve to another.
		expect(tombstoneAuthIdFor(7)).toBe("erased-7");
		expect(tombstoneAuthIdFor(8)).not.toBe(tombstoneAuthIdFor(7));
	});

	it("never produces the empty authID that the repository guards against", () => {
		// createLocalUser writes authID: "" for every self-hosted user, and
		// getUserByAuthID short-circuits on empty input for that reason. A
		// tombstone that landed on "" would be invisible to that lookup.
		for (const id of [0, 1, 999999]) {
			expect(tombstoneAuthIdFor(id).trim().length).toBeGreaterThan(0);
		}
	});

	it("produces an authID no identity provider can issue", () => {
		// Real Auth0 subs are `<connection>|<id>`. Without the separator a
		// tombstone can never be matched by a live login.
		expect(tombstoneAuthIdFor(7)).not.toContain("|");
	});

	it("is idempotent — a re-run produces the same values", () => {
		expect(tombstoneEmailFor(42)).toBe(tombstoneEmailFor(42));
		expect(tombstoneAuthIdFor(42)).toBe(tombstoneAuthIdFor(42));
	});

	it("recognises its own addresses and nothing else", () => {
		expect(isTombstoneEmail(tombstoneEmailFor(7))).toBe(true);
		expect(isTombstoneEmail("  erased-7@erased.invalid ")).toBe(true);
		expect(isTombstoneEmail("person@example.com")).toBe(false);
		expect(isTombstoneEmail("erased-someone@erased.invalid")).toBe(false);
		expect(isTombstoneEmail("erased-7@example.com")).toBe(false);
	});

	it("names the person the same way everywhere", () => {
		expect(TOMBSTONE_NAME).toBe("Deleted user");
	});
});

describe("redactEmailInText", () => {
	const tombstone = tombstoneEmailFor(7);

	it("rewrites the description createPersonalOrganization bakes an address into", () => {
		expect(
			redactEmailInText("Personal organization for a.person@example.com", "a.person@example.com", tombstone),
		).toBe(`Personal organization for ${tombstone}`);
	});

	it("matches regardless of the casing the address was stored in", () => {
		expect(redactEmailInText("Personal project for A.Person@Example.COM", "a.person@example.com", tombstone)).toBe(
			`Personal project for ${tombstone}`,
		);
	});

	it("treats the address as a literal, not a pattern", () => {
		// A dot in an unescaped regex matches any character, so an unescaped
		// implementation would rewrite a DIFFERENT person's description.
		expect(redactEmailInText("Personal project for aXperson@example.com", "a.person@example.com", tombstone)).toBe(
			"Personal project for aXperson@example.com",
		);
	});

	it("replaces every occurrence, not just the first", () => {
		expect(redactEmailInText("me@x.io invited me@x.io", "me@x.io", tombstone)).toBe(
			`${tombstone} invited ${tombstone}`,
		);
	});

	it("returns the input unchanged when there is nothing to replace", () => {
		const text = "Personal organization for someone.else@example.com";
		// Identity, so the caller can skip the write entirely.
		expect(redactEmailInText(text, "a.person@example.com", tombstone)).toBe(text);
		expect(redactEmailInText(text, "   ", tombstone)).toBe(text);
	});
});
