import { z } from "zod";

/**
 * Email addresses are internationalized: the domain can be an IDN (`user@müller.de`,
 * RFC 5890) and, under SMTPUTF8 (RFC 6531), so can the local part (`jörg@example.com`).
 * Zod's default `z.email()` pattern is ASCII-only and rejects both, which is why a German
 * umlaut used to fail registration outright.
 *
 * Accepting Unicode is only half the job. The same address can be typed as more than one
 * byte sequence, and `User.email` is a `@unique` column compared with `=` in Postgres and
 * with `!==` in the invitation checks -- so two spellings of one address become two
 * accounts, or an invitation that its own recipient cannot accept. Every address is
 * therefore normalized at the boundary and only the normalized form is ever stored.
 */

/**
 * The pattern an address must match.
 *
 * It starts from zod's `unicodeEmail` -- `/^[^\s@"]{1,64}@[^\s@]{1,255}$/u`, which is what
 * makes non-ASCII acceptable on both sides of the `@` -- and adds one requirement zod does
 * not make: the domain is two or more non-empty labels separated by dots.
 *
 * That is deliberately stricter than the standard. `user@localhost` is a valid address and
 * this rejects it, but nobody registers for a hosted product from a domain we could not
 * deliver to, whereas `user@gmailcom` is a typo somebody makes every day -- and zod's
 * pattern accepts it. Requiring the dot is the whole of the old ASCII regex worth keeping;
 * what made that one a bug was the character class, not the shape.
 *
 * The lookahead carries the overall domain length so the label rule and the 255-character
 * limit do not have to be expressed twice.
 */
export const EMAIL_PATTERN = /^[^\s@"]{1,64}@(?=[^\s@]{1,255}$)[^\s@.]+(?:\.[^\s@.]+)+$/u;

/**
 * Fold an address to the single form we store and compare.
 *
 * - **NFC** because RFC 6532 §3.1 says UTF-8 headers should use it, and because `ö` has
 *   two encodings (U+00F6, or `o` + U+0308) that look identical and compare unequal. A
 *   macOS client typically sends NFD, so this is not a theoretical case.
 * - **Lowercase** the whole address. RFC 5321 §2.4 makes the domain case-insensitive
 *   outright; the local part is formally case-sensitive, but no mailbox provider we can
 *   deliver to actually treats `Jörg@` and `jörg@` as different people, and keeping the
 *   distinction would mean the unique index happily accepts both as separate accounts.
 * - **NFC again** after lowercasing: case folding can decompose. `İ` (U+0130) lowercases
 *   to `i` + U+0307, and the second pass is what keeps the result in a single canonical
 *   form regardless of what came in.
 *
 * Order matters -- trim, compose, fold, compose -- and swapping the last two steps
 * reintroduces exactly the duplicate-account bug this exists to prevent.
 */
export function normalizeEmail(email: string): string {
	return email.trim().normalize("NFC").toLowerCase().normalize("NFC");
}

/**
 * The single email validator for the API surface.
 *
 * Normalization runs *before* validation, not after. A pasted address routinely arrives
 * with a trailing space, and EMAIL_PATTERN excludes whitespace -- validating first would
 * reject it instead of trimming it. Running the transform first also means the pattern
 * only ever sees the canonical form, so what is validated and what is stored cannot be
 * two different strings: there is no path through this schema that produces an
 * unnormalized address.
 */
export const emailSchema = z
	.string()
	.transform(normalizeEmail)
	.pipe(z.email({ pattern: EMAIL_PATTERN, message: "Invalid email address" }));

/**
 * True when two addresses are the same mailbox. Stored values are already normalized, but
 * comparing through this keeps the check correct for rows written before the normalizing
 * migration and for values that arrive from outside our own schemas (identity providers,
 * webhooks).
 */
export function emailsMatch(a: string, b: string): boolean {
	return normalizeEmail(a) === normalizeEmail(b);
}
