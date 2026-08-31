import { isTombstoneEmail } from "./tombstone";

/**
 * Whether an account may be closed, decided from facts alone.
 *
 * Pure on purpose: the refusals are the part that must be provable, and a
 * decision that needs a database to exercise is a decision nobody tests.
 */

export type OrganizationRoleName = "OWNER" | "ADMIN" | "READER";

export type OrganizationMembershipFacts = {
	organizationId: number;
	role: OrganizationRoleName;
	/** OWNER rows in this organization, the subject included. */
	ownerCount: number;
	/** Member rows in this organization, the subject included. */
	memberCount: number;
};

export type LabErasureSubject = {
	userId: number;
	email: string;
	/** Non-null once the row has been tombstoned. */
	erasedAt: Date | null;
	/**
	 * `systemConfig[SYSTEM_USER_ID]`, when the instance has one configured.
	 * `null` on an instance that never bootstrapped a system user.
	 */
	systemUserId: number | null;
	organizations: readonly OrganizationMembershipFacts[];
};

export type LabErasureRefusal = "system_user" | "sole_owner_of_shared_organization";

export type LabErasureDecision =
	| { erasable: true; alreadyErased: boolean }
	| { erasable: false; reason: LabErasureRefusal; detail: string };

/**
 * The legacy system account, from before `systemConfig` held its id.
 * `SystemService.ensureSystemUserExists` still looks this address up on every
 * boot to migrate it, and `countNonSystemUsers` still excludes it.
 */
const LEGACY_SYSTEM_USER_EMAIL = "SYSTEM_USER";

/**
 * A shared organization is one with members other than the subject. The
 * `Organization.personal` flag is deliberately NOT used for this: it is
 * `@default(true)`, set once at creation, and nothing keeps it honest when a
 * personal organization is later shared. Member counts are the truth; the flag
 * is a hint.
 */
function isSoleOwnerOfSharedOrganization(m: OrganizationMembershipFacts): boolean {
	return m.role === "OWNER" && m.ownerCount <= 1 && m.memberCount > 1;
}

export function decideLabErasure(subject: LabErasureSubject): LabErasureDecision {
	// Refusal order is fixed so the reported reason is stable: an account that
	// trips two guards always reports the same one.

	// 1. The system account. Erasing it locks the instance out of its own
	//    bootstrap: `ensureSystemUserExists` would find no configured user, fail
	//    to match the legacy address, and create a second system user on the next
	//    boot — while the tombstoned one keeps its organizations.
	const isSystemUser =
		(subject.systemUserId !== null && subject.systemUserId === subject.userId) ||
		subject.email.trim() === LEGACY_SYSTEM_USER_EMAIL;
	if (isSystemUser) {
		return {
			erasable: false,
			reason: "system_user",
			detail:
				"This is the instance's system account. Closing it would break the " +
				"bootstrap that runs on every boot.",
		};
	}

	// 2. The last owner of an organization other people are still in. Removing
	//    the only OWNER leaves that organization unadministrable by anyone —
	//    nobody left can invite, change roles, or close it. A human has to hand
	//    ownership over first. This is the rule GitHub applies to organizations,
	//    for the same reason.
	const orphaned = subject.organizations.filter(isSoleOwnerOfSharedOrganization);
	if (orphaned.length > 0) {
		const ids = orphaned.map((m) => m.organizationId).join(", ");
		return {
			erasable: false,
			reason: "sole_owner_of_shared_organization",
			detail:
				`Sole OWNER of shared organization(s): ${ids}. Transfer ownership ` +
				"before closing the account.",
		};
	}

	// A row that already carries a tombstone is still erasable — re-running a
	// closure must succeed rather than start failing. `alreadyErased` lets the
	// caller report "nothing left to do" instead of inventing a second event.
	return {
		erasable: true,
		alreadyErased: subject.erasedAt !== null || isTombstoneEmail(subject.email),
	};
}
