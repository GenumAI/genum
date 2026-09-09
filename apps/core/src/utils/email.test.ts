import { describe, expect, it } from "vitest";
import { emailSchema, emailsMatch, normalizeEmail } from "./email";

// `ö` written both ways: composed (U+00F6) and decomposed (`o` + U+0308). They render
// identically, so nothing but a byte comparison tells them apart -- which is also why the
// decomposed form is built here rather than pasted as a literal an editor could silently
// recompose.
const NFC_UMLAUT = "jörg@example.com".normalize("NFC");
const NFD_UMLAUT = NFC_UMLAUT.normalize("NFD");

describe("normalizeEmail", () => {
	it("composes decomposed characters so both spellings collapse to one address", () => {
		expect(NFC_UMLAUT).not.toBe(NFD_UMLAUT);
		expect(normalizeEmail(NFD_UMLAUT)).toBe(NFC_UMLAUT);
	});

	it("lowercases non-ASCII letters, not just ASCII ones", () => {
		expect(normalizeEmail("JÖRG@EXAMPLE.COM")).toBe(NFC_UMLAUT);
	});

	it("trims surrounding whitespace", () => {
		expect(normalizeEmail("  a.person@example.com \n")).toBe("a.person@example.com");
	});

	it("returns a value that is already normalized", () => {
		// Case folding can decompose -- `İ` (U+0130) lowercases to `i` + U+0307 -- so a
		// second pass must be a no-op or the stored form depends on how it was typed.
		for (const input of ["İstanbul@example.com", "ẞ@example.de", NFD_UMLAUT]) {
			const once = normalizeEmail(input);
			expect(normalizeEmail(once)).toBe(once);
		}
	});
});

describe("emailSchema", () => {
	it.each([
		["ascii", "a.person@example.com"],
		["umlaut in the local part (SMTPUTF8, RFC 6531)", NFC_UMLAUT],
		["umlaut in the domain (IDN)", "user@müller.de"],
		["the punycode form of that domain", "user@xn--mller-kva.de"],
		["a plus-addressed mailbox", "a.person+genum@example.com"],
		["an address pasted with whitespace around it", "  a.person@example.com \n"],
	])("accepts %s", (_label, email) => {
		expect(emailSchema.safeParse(email).success).toBe(true);
	});

	it.each([
		["no domain", "a.person"],
		["no local part", "@example.com"],
		["a space inside", "a person@example.com"],
		["two @", "a@b@example.com"],
		["empty", ""],
	])("rejects %s", (_label, email) => {
		expect(emailSchema.safeParse(email).success).toBe(false);
	});

	it("returns the normalized address, not the input", () => {
		expect(emailSchema.parse(` ${NFD_UMLAUT.toUpperCase()} `)).toBe(NFC_UMLAUT);
	});
});

describe("emailsMatch", () => {
	it("matches the same mailbox across encoding and case", () => {
		expect(emailsMatch(NFD_UMLAUT, "JÖRG@Example.com")).toBe(true);
	});

	it("does not match different mailboxes", () => {
		expect(emailsMatch(NFC_UMLAUT, "jorg@example.com")).toBe(false);
	});
});
