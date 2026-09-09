/**
 * Client-side mirror of `normalizeEmail` / `emailSchema` in apps/core/src/utils/email.ts.
 * The server is the authority -- it re-validates and re-normalizes everything it is sent --
 * but the browser has to agree with it, because a form that rejects `jörg@example.com`
 * never gives the server the chance to accept it.
 *
 * Kept as a copy rather than a shared package: two small pure functions are cheaper to
 * duplicate than a new workspace package in the build graph. Change one, change the other.
 */

/**
 * The pattern core validates against. It allows non-ASCII on both sides of the `@` -- an
 * IDN domain (`user@müller.de`) and, under SMTPUTF8, an internationalized local part
 * (`jörg@example.com`) -- while still requiring the domain to be two or more non-empty
 * dot-separated labels, so `user@gmailcom` is caught as the typo it is.
 *
 * Must stay byte-identical to EMAIL_PATTERN in apps/core/src/utils/email.ts, which carries
 * the reasoning behind each half of it.
 */
export const EMAIL_PATTERN = /^[^\s@"]{1,64}@(?=[^\s@]{1,255}$)[^\s@.]+(?:\.[^\s@.]+)+$/u;

/**
 * Trim, compose, lowercase, compose again -- the same four steps as the server, in the
 * same order. See the core module for why each one is there; the short version is that
 * `ö` has two encodings that compare unequal, and case folding can undo composition.
 */
export function normalizeEmail(email: string): string {
	return email.trim().normalize("NFC").toLowerCase().normalize("NFC");
}
