/**
 * Every relation on `User`, classified for account closure.
 *
 * The dangerous defect in an erasure is not a bug in the code that runs. It is a
 * relation added to `User` six months from now, in a feature that has nothing to
 * do with erasure, whose rows then quietly survive every future closure. Nothing
 * about that shows up in review and every test keeps passing.
 *
 * So the world is closed: `user-relations.test.ts` reads `prisma/models/*.prisma`
 * as TEXT and fails until each relation field on `model User` appears in exactly
 * one of the two lists below. Text, not the generated client's metadata — the
 * client is a build artifact, and a stale one describes yesterday's schema and
 * would pass on precisely the change the test exists to catch.
 */

/** Rows deleted outright when an account is closed. */
export type ErasedRelation = {
	/** The relation field name on `model User`. */
	relation: string;
	/** The Prisma model holding the rows. */
	model: string;
	/** The column on that model pointing back at `User.id`. */
	userIdField: string;
	why: string;
};

/** Rows left in place, each with the grounds for keeping them. */
export type RetainedRelation = {
	relation: string;
	model: string;
	grounds: string;
};

/**
 * Deleted. Two things earn a place here and nothing else does: a row that is an
 * authentication path back into the account, or a row that is the person's own
 * activity and carries no value for the organization.
 *
 * Order is not load-bearing in Lab — none of these four cascades from another —
 * but it is still the order the executor runs in, so keep any future entry that
 * a sibling cascades from ABOVE its parent. Deleting a parent first takes the
 * children with it and then reports `0` for them, which is an evidence line that
 * understates its own erasure.
 */
export const ERASED_USER_RELATIONS: readonly ErasedRelation[] = [
	{
		relation: "userSessions",
		model: "UserSession",
		userIdField: "userId",
		why:
			"A live session is an authentication path that survives the closure. " +
			"It also holds `ip` and `userAgent`, which are personal data in their " +
			"own right.",
	},
	{
		relation: "userCredentials",
		model: "UserCredential",
		userIdField: "userId",
		why:
			"The password hash is both personal data and the second way back into " +
			"the account. Self-hosted accounts authenticate with nothing else.",
	},
	{
		relation: "promptChats",
		model: "PromptChat",
		userIdField: "userId",
		why:
			"The person's own conversation with a prompt, one per user per prompt, " +
			"holding free-text messages they wrote. `PromptChatMessage` cascades " +
			"from it. No other member can see it, so nothing organizational is lost.",
	},
	{
		relation: "notificationReads",
		model: "NotificationRead",
		userIdField: "userId",
		why:
			"A per-user read marker. It is a record of when this person looked at " +
			"something and it means nothing once the person is gone.",
	},
] as const;

/**
 * Retained. Each entry states the grounds, because "we did not get to it" and
 * "we decided to keep it" are indistinguishable in a schema.
 *
 * The reason so much can be retained here is the tombstone itself: after closure
 * every one of these rows points at an anonymised record, so a join through them
 * yields `Deleted user` rather than a person. Retention of a foreign key to an
 * anonymised row is not retention of personal data.
 */
export const RETAINED_USER_RELATIONS: readonly RetainedRelation[] = [
	{
		relation: "organizationMemberships",
		model: "OrganizationMember",
		grounds:
			"The row is `(userId, organizationId, role)` — no personal data once " +
			"the identity is tombstoned — and it authorizes nobody, because every " +
			"authentication path is deleted above and `authID` becomes a value no " +
			"identity provider can produce. Deleting it would be actively harmful " +
			"for the personal organization, whose only member is the subject: the " +
			"organization, its projects and its prompts would be left with no owner " +
			"at all, reachable and deletable by no one — and AI MailOps calls those " +
			"prompts by `prompt_id`, so orphaning them breaks a live tenant. A sole " +
			"OWNER of a SHARED organization is refused before we get here.",
	},
	{
		relation: "projectMemberships",
		model: "ProjectMember",
		grounds:
			"Same shape and same reasoning as the organization membership above, " +
			"one level down.",
	},
	{
		relation: "commits",
		model: "PromptVersion",
		grounds:
			"Prompt version history belongs to the organization, not to the person " +
			"who happened to write a commit. `authorId` is nullable and would go to " +
			"NULL on a delete, which loses the ability to tell two authors apart in " +
			"a history the organization still relies on. The tombstone anonymises " +
			"the author without flattening the provenance.",
	},
	{
		relation: "projectApiKeys",
		model: "ProjectApiKey",
		grounds:
			"A project API key authorizes the PROJECT; `authorId` is attribution. " +
			"Other members' integrations run on it, so revoking it on one person's " +
			"departure is a denial of service against the organization. This is the " +
			"same line GitHub draws between a personal access token, which dies with " +
			"the account, and a deploy key, which does not.",
	},
] as const;

/**
 * Free-text and unlinked places the subject's address reaches, which no walk of
 * the relations above would ever find. Recorded here so the closed-world test
 * has one file to point a reader at.
 *
 *  - `OrganizationInvitation.email` — keyed `(email, organizationId)` with NO
 *    `userId` column at all. A pending invitation would keep the real address
 *    forever. It must be deleted by the PRE-tombstone address.
 *  - `Organization.description` / `Project.description` — `Personal organization
 *    for <email>` and `Personal project for <email>`, written at signup.
 *
 * Across Lab's whole schema an address appears in exactly two columns:
 * `User.email` and `OrganizationInvitation.email`. The two descriptions are free
 * text that happens to contain one.
 */
export const UNLINKED_EMAIL_SITES = [
	"OrganizationInvitation.email",
	"Organization.description",
	"Project.description",
] as const;
