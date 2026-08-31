import type { Database } from "@/database/db";
import { env } from "@/env";
import { decideLabErasure } from "@/erasure/decide-user-erasure";
import type { MailCallFailure, MailErasureClient } from "./mail-erasure-client";

/**
 * Closing an account across every system that holds it.
 *
 * Genum decides and drives; the mail service erases its own copy and makes the
 * identity-provider calls. The order below is the whole design, and each step
 * blocks the next:
 *
 *   1. our guard          refuse before anything is written
 *   2. their guard        refuse before anything is written
 *   3. lock out           enumerate every identity, block each, kill sessions
 *   4. their tombstone
 *   5. our tombstone
 *   6. delete identities
 *
 * Steps 1 and 2 both run before step 3 on purpose. That is what makes this a
 * two-phase commit rather than a fan-out: without it we lock someone out of
 * their identity provider and only then discover a leg refuses, leaving a person
 * unable to log in with nothing erased anywhere.
 *
 * Deleting the identities is LAST because it is the only irreversible step. Once
 * an identity is gone the subject cannot be looked up by it again, so anything
 * that still needed it must already have run.
 */

export type ClosureStep =
	| "lab_guard"
	| "mail_guard"
	| "auth0_lockout"
	| "mail_erase"
	| "lab_erase"
	| "auth0_delete";

export type ClosureOutcome =
	| { status: "not_found" }
	| { status: "refused"; step: ClosureStep; reason: string; detail: string }
	| { status: "failed"; step: ClosureStep; completed: ClosureStep[]; detail: string }
	| {
			status: "closed";
			completed: ClosureStep[];
			identitiesDeleted: number;
			alreadyErased: boolean;
			/** True on a self-hosted instance, where this is the only system. */
			labOnly: boolean;
	  };

export type ClosurePreview =
	| { status: "not_found" }
	| { status: "refused"; step: ClosureStep; reason: string; detail: string }
	| { status: "erasable"; alreadyErased: boolean; labOnly: boolean };

export class AccountClosureService {
	private db: Database;
	private mail: MailErasureClient;

	constructor(db: Database, mail: MailErasureClient) {
		this.db = db;
		this.mail = mail;
	}

	/**
	 * Whether every system would accept this closure. Writes nothing, anywhere.
	 * Run this before showing a confirmation: a refusal discovered afterwards is
	 * a refusal discovered too late.
	 */
	public async previewClosure(userId: number): Promise<ClosurePreview> {
		const subject = await this.db.erasure.getErasureSubject(userId);
		if (!subject) {
			return { status: "not_found" };
		}

		const decision = decideLabErasure(subject);
		if (!decision.erasable) {
			return {
				status: "refused",
				step: "lab_guard",
				reason: decision.reason,
				detail: decision.detail,
			};
		}

		const reach = this.resolveReach();
		if (reach.kind === "refuse") {
			return {
				status: "refused",
				step: "mail_guard",
				reason: reach.reason,
				detail: reach.detail,
			};
		}
		if (reach.kind === "lab_only") {
			return { status: "erasable", alreadyErased: decision.alreadyErased, labOnly: true };
		}

		const erasability = await this.mail.erasability(subject.email);
		if (!erasability.ok) {
			const mapped = mapFailure("mail_guard", erasability, []);
			return mapped.status === "refused"
				? mapped
				: {
						status: "refused",
						step: "mail_guard",
						reason: "mail_service_unreachable",
						detail: mapped.detail,
					};
		}
		if (!erasability.value.erasable && !erasability.value.notFound) {
			return {
				status: "refused",
				step: "mail_guard",
				reason: erasability.value.reason ?? "refused",
				detail: erasability.value.detail ?? "The mail service refused this closure.",
			};
		}

		return { status: "erasable", alreadyErased: decision.alreadyErased, labOnly: false };
	}

	/**
	 * Close the account.
	 *
	 * Every step is individually idempotent, so re-running a closure that died
	 * part way through is both safe and the intended recovery. `completed` exists
	 * so an operator can see how far the failed run got without inferring it.
	 */
	public async closeAccount(userId: number): Promise<ClosureOutcome> {
		const completed: ClosureStep[] = [];

		const subject = await this.db.erasure.getErasureSubject(userId);
		if (!subject) {
			return { status: "not_found" };
		}

		// 1. Our own guard.
		const decision = decideLabErasure(subject);
		if (!decision.erasable) {
			return {
				status: "refused",
				step: "lab_guard",
				reason: decision.reason,
				detail: decision.detail,
			};
		}
		completed.push("lab_guard");

		// The address, read BEFORE our tombstone overwrites it. The mail service
		// and the identity provider both find the person by it.
		const email = subject.email;

		const reach = this.resolveReach();
		if (reach.kind === "refuse") {
			return {
				status: "refused",
				step: "mail_guard",
				reason: reach.reason,
				detail: reach.detail,
			};
		}

		if (reach.kind === "lab_only") {
			// Self-hosted: this is the only system that holds the account.
			try {
				await this.db.erasure.eraseUser(userId, email);
			} catch (error) {
				return { status: "failed", step: "lab_erase", completed, detail: describe(error) };
			}
			completed.push("lab_erase");
			return {
				status: "closed",
				completed,
				identitiesDeleted: 0,
				alreadyErased: decision.alreadyErased,
				labOnly: true,
			};
		}

		// 2. Their guard. Still nothing written.
		const erasability = await this.mail.erasability(email);
		if (!erasability.ok) {
			return mapFailure("mail_guard", erasability, completed);
		}
		if (!erasability.value.erasable && !erasability.value.notFound) {
			return {
				status: "refused",
				step: "mail_guard",
				reason: erasability.value.reason ?? "refused",
				detail: erasability.value.detail ?? "The mail service refused this closure.",
			};
		}
		completed.push("mail_guard");

		// 3. Lock every identity out. First step that changes anything.
		const lockout = await this.mail.lockout(email);
		if (!lockout.ok) {
			return mapFailure("auth0_lockout", lockout, completed);
		}
		completed.push("auth0_lockout");
		const identities = lockout.value.identities.map((i) => i.userId);

		// 4. Their tombstone.
		const erased = await this.mail.erase(email);
		if (!erased.ok) {
			return mapFailure("mail_erase", erased, completed);
		}
		completed.push("mail_erase");

		// 5. Ours.
		try {
			await this.db.erasure.eraseUser(userId, email);
		} catch (error) {
			return { status: "failed", step: "lab_erase", completed, detail: describe(error) };
		}
		completed.push("lab_erase");

		// 6. Delete the identities enumerated in step 3 — the irreversible one.
		const deleted = await this.mail.auth0Delete(identities);
		if (!deleted.ok) {
			return mapFailure("auth0_delete", deleted, completed);
		}
		completed.push("auth0_delete");

		return {
			status: "closed",
			completed,
			identitiesDeleted: deleted.value.deleted.length,
			alreadyErased: decision.alreadyErased,
			labOnly: false,
		};
	}

	/**
	 * Whether the other systems are reachable, and what to do when they are not.
	 *
	 * This is the one branch that must not be collapsed. A self-hosted instance
	 * has no identity provider and no mail service, so refusing there would make
	 * every account unclosable — the closure is simply local. A cloud instance
	 * always has an identity-provider account, so a missing configuration means
	 * we would silently leave the person able to log in while telling them their
	 * account is closed. The first case must proceed; the second must refuse.
	 */
	private resolveReach():
		| { kind: "full" }
		| { kind: "lab_only" }
		| { kind: "refuse"; reason: string; detail: string } {
		if (this.mail.isConfigured()) {
			return { kind: "full" };
		}
		if (env.INSTANCE_TYPE === "cloud") {
			return {
				kind: "refuse",
				reason: "cross_system_closure_not_configured",
				detail:
					"This is a cloud instance, so the account also exists at the identity provider. " +
					"Set MAIL_SERVICE_URL and MAIL_ERASURE_APIKEY, or the closure would leave that " +
					"account able to log in.",
			};
		}
		return { kind: "lab_only" };
	}
}

/**
 * A refusal from the other side stays a refusal; everything else is a failure at
 * the step it happened on. The distinction matters to whoever reads the outcome:
 * a refusal needs a human decision, a failure needs a retry.
 */
function mapFailure(
	step: ClosureStep,
	failure: MailCallFailure,
	completed: ClosureStep[],
): Extract<ClosureOutcome, { status: "refused" } | { status: "failed" }> {
	if (failure.kind === "refused") {
		return { status: "refused", step, reason: failure.reason, detail: failure.detail };
	}
	return { status: "failed", step, completed: [...completed], detail: failure.detail };
}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
