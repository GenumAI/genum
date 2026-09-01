/**
 * The values an erased user's row carries once the account is closed.
 *
 * Lab tombstones the `User` row, it never deletes it. Seven of the eight
 * relations pointing at `User` are `onDelete: Cascade`, so a delete would take
 * the organization's prompt chats, project memberships and API keys with it —
 * and `PromptVersion.author` would go to NULL, erasing the provenance of prompt
 * history that belongs to the organization rather than to the person.
 *
 * Every replaced value is DERIVED FROM THE ROW'S OWN PRIMARY KEY. Two reasons,
 * and neither is cosmetic:
 *
 *  - The id is already in the row, so deriving from it leaks nothing the row did
 *    not already hold. A random value would leak nothing either, but it buys
 *    nothing to pay for what it costs below.
 *  - It makes the write IDEMPOTENT. A closure that crashes half way through can
 *    be re-run and produce byte-identical values, and an already-tombstoned row
 *    is recognisable as such. With random values, "already done" and "not yet"
 *    are indistinguishable.
 */

/**
 * RFC 2606 reserves `.invalid` as a top-level domain that can never be
 * registered, so nothing addressed here is deliverable — not by us, and not by
 * anything that later reads the column.
 */
export const TOMBSTONE_EMAIL_DOMAIN = "erased.invalid";

/** Rendered wherever the UI shows a person's name. `User.name` is NOT NULL. */
export const TOMBSTONE_NAME = "Deleted user";

/** `User.email` is `@unique`, so the placeholder must differ per row. */
export function tombstoneEmailFor(userId: number): string {
	return `erased-${userId}@${TOMBSTONE_EMAIL_DOMAIN}`;
}

/**
 * `User.authID` is NOT NULL and carries no unique constraint, which is exactly
 * why a shared constant is unsafe here.
 *
 * `UsersRepository.getUserByAuthID` is a `findFirst`, and it opens with
 * `if (authID.trim().length === 0) return null`. That guard exists because
 * `createLocalUser` writes `authID: ""` for every self-hosted user, so without
 * it one empty lookup would return an arbitrary local account. A tombstone
 * constant such as `"deleted"` would recreate that bug exactly, past the guard:
 * the second erased user's `findFirst` would return the first one.
 *
 * Deriving from the id makes a wrong match impossible. No Auth0 `sub` has this
 * shape either — real ones are `<connection>|<id>` — so a live login can never
 * resolve onto a tombstone.
 */
export function tombstoneAuthIdFor(userId: number): string {
	return `erased-${userId}`;
}

/**
 * True for an address this module produced. Lets a caller tell a tombstone from
 * a real address without a database round trip — a re-run must not treat
 * `erased-7@erased.invalid` as the subject's own address and go looking for it
 * in free text.
 */
export function isTombstoneEmail(email: string): boolean {
	return /^erased-\d+@erased\.invalid$/i.test(email.trim());
}

/** Escape a literal for embedding in a RegExp. */
function escapeRegExp(literal: string): string {
	return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace every occurrence of `email` in `text`, case-insensitively.
 *
 * `OrganizationRepository.createPersonalOrganization` bakes the address into two
 * free-text columns — `Personal organization for <email>` and `Personal project
 * for <email>` — so those columns hold personal data that no walk of the user's
 * relations would ever reach. Matching is case-insensitive because an address
 * stored with different casing than the one being erased is the same address.
 *
 * Returns the input unchanged when there is nothing to replace, so a caller can
 * compare by identity to decide whether a write is needed at all.
 */
export function redactEmailInText(text: string, email: string, replacement: string): string {
	const needle = email.trim();
	if (needle.length === 0) {
		return text;
	}
	return text.replace(new RegExp(escapeRegExp(needle), "gi"), replacement);
}
