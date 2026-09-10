import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AuthNewUserSchema } from "./auth.type";
import { OrganizationMemberInviteSchema } from "./organization.type";
import { LocalUserLoginSchema, LocalUserRegisterSchema } from "./user.type";

// The umlaut bug did not live in a validator -- it lived in which validator each schema
// happened to reach for. `emailSchema` being correct proves nothing on its own if a
// request schema still calls `z.email()`, so these tests exercise the four schemas that
// actually stand between a person and an account.

const NFC_UMLAUT = "jörg@example.com".normalize("NFC");
// As a macOS client would send it, shouted, with a stray trailing space.
const AS_TYPED = ` ${NFC_UMLAUT.normalize("NFD").toUpperCase()} `;

const boundaries = [
	{
		name: "AuthNewUserSchema (Auth0 sign-up hook)",
		parse: (email: string) =>
			AuthNewUserSchema.parse({
				email,
				name: "Jörg",
				authID: "auth0|aaa",
				created_at: "2026-09-09T00:00:00.000Z",
			}).email,
	},
	{
		name: "LocalUserRegisterSchema",
		parse: (email: string) =>
			LocalUserRegisterSchema.parse({ email, name: "Jörg", password: "hunter2hunter2" })
				.email,
	},
	{
		name: "LocalUserLoginSchema",
		parse: (email: string) =>
			LocalUserLoginSchema.parse({ email, password: "hunter2hunter2" }).email,
	},
	{
		name: "OrganizationMemberInviteSchema",
		parse: (email: string) => OrganizationMemberInviteSchema.parse({ email }).email,
	},
];

describe.each(boundaries)("$name", ({ parse }) => {
	it("accepts an internationalized address", () => {
		expect(parse(NFC_UMLAUT)).toBe(NFC_UMLAUT);
	});

	it("normalizes it, so registration and login agree on one spelling", () => {
		// Register through one of these and log in through another: if either skipped
		// normalization, `User.email` is looked up with `=` and the account is unreachable.
		expect(parse(AS_TYPED)).toBe(NFC_UMLAUT);
	});

	it("still rejects a domain with no dot", () => {
		expect(() => parse("jörg@gmailcom")).toThrow();
	});
});

describe("the validate/types directory", () => {
	// A closed world, in the spirit of erasure/user-relations.test.ts. The defect worth
	// preventing is not this change being wrong -- it is a schema added months from now, in
	// an unrelated feature, that reaches for zod's ASCII-only default and quietly
	// reintroduces the bug for its own endpoint while every test above still passes.
	it("declares no email field outside emailSchema", () => {
		// Vitest runs with apps/core as the working directory. Asserting the directory is
		// where we expect keeps a future move from turning this guard into a vacuous pass
		// over an empty listing.
		const dir = resolve(process.cwd(), "src/services/validate/types");
		expect(existsSync(dir), `${dir} does not exist`).toBe(true);

		const offenders: string[] = [];

		for (const file of readdirSync(dir)) {
			if (!file.endsWith(".type.ts")) continue;
			const source = readFileSync(join(dir, file), "utf8");
			// Both spellings of zod's own email validator: `z.email()` (v4) and the
			// deprecated `z.string().email()` this codebase also had.
			if (/z\s*\.\s*email\s*\(|\.\s*string\s*\(\s*\)\s*\.\s*email\s*\(/.test(source)) {
				offenders.push(file);
			}
		}

		expect(
			offenders,
			"use emailSchema from @/utils/email -- zod's own email validator is ASCII-only and rejects addresses like jörg@example.com",
		).toEqual([]);
	});
});
