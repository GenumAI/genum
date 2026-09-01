import type { Database } from "@/database/db";
import type { LabErasureCounts } from "@/database/repositories/ErasureRepository";
import { decideLabErasure, type LabErasureRefusal } from "@/erasure/decide-user-erasure";

/**
 * Closing a Genum Lab account.
 *
 * This is the Lab leg of the cross-system closure. Lab decides and drives the
 * order; AI MailOps and Auth0 are the other two legs and are NOT touched here.
 *
 * Every path into a closure goes through this service, so the preview and the
 * write can never disagree about who is erasable — if they could, which entry
 * point an operator happened to reach would decide what survived, and only an
 * auditor would ever find out.
 */

export type LabErasureOutcome =
	| { status: "not_found" }
	| { status: "refused"; reason: LabErasureRefusal; detail: string }
	| { status: "erasable"; alreadyErased: boolean; counts: LabErasureCounts }
	| { status: "erased"; alreadyErased: boolean; counts: LabErasureCounts };

export class ErasureService {
	private db: Database;

	constructor(db: Database) {
		this.db = db;
	}

	/**
	 * Whether this account can be closed, and what closing it would touch.
	 * Writes nothing.
	 *
	 * This is what makes the cross-system closure a two-phase commit rather than
	 * a fan-out. Without it the orchestrator blocks the Auth0 identity first and
	 * only then discovers that a leg refuses — leaving someone locked out with
	 * nothing erased.
	 */
	public async previewErasure(userId: number): Promise<LabErasureOutcome> {
		const subject = await this.db.erasure.getErasureSubject(userId);
		if (!subject) {
			return { status: "not_found" };
		}

		const decision = decideLabErasure(subject);
		if (!decision.erasable) {
			return { status: "refused", reason: decision.reason, detail: decision.detail };
		}

		return {
			status: "erasable",
			alreadyErased: decision.alreadyErased,
			counts: await this.db.erasure.previewErasure(userId, subject.email),
		};
	}

	/**
	 * Close the account: tombstone the row, delete every authentication path,
	 * and clear the address out of the places no relation walk reaches.
	 *
	 * Re-running is safe and is expected — a closure that failed part way through
	 * must be finishable. A second run reports `alreadyErased: true` with zero
	 * counts rather than failing.
	 */
	public async eraseUser(userId: number): Promise<LabErasureOutcome> {
		const subject = await this.db.erasure.getErasureSubject(userId);
		if (!subject) {
			return { status: "not_found" };
		}

		const decision = decideLabErasure(subject);
		if (!decision.erasable) {
			return { status: "refused", reason: decision.reason, detail: decision.detail };
		}

		// The subject's CURRENT address, which on a re-run is already a tombstone.
		// The repository handles that by matching nothing.
		const counts = await this.db.erasure.eraseUser(userId, subject.email);

		return { status: "erased", alreadyErased: decision.alreadyErased, counts };
	}
}
