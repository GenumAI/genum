import type { Request, Response } from "express";
import { db } from "@/database/db";
import { AccountClosureService } from "@/services/account-closure.service";
import { MailErasureClient } from "@/services/mail-erasure-client";
import type { ClosureOutcome, ClosurePreview } from "@/services/account-closure.service";

/**
 * Self-service account closure, for the signed-in person's OWN account.
 *
 * The subject is always the caller, read from the verified token. It is never
 * taken from the request body: a body-supplied id would let any signed-in person
 * close anyone's account, and no amount of guarding elsewhere would fix that.
 *
 * There is no grace period and no cancel path. The closure is irreversible the
 * moment it is accepted, which is why the route carries a re-authentication
 * guard and the UI a deliberate confirmation.
 */
export class ClosureController {
	private readonly service: AccountClosureService;

	constructor() {
		this.service = new AccountClosureService(db, new MailErasureClient());
	}

	/**
	 * What closing this account would touch. Writes nothing, anywhere, so the UI
	 * can show the consequences before offering the button.
	 *
	 * A refusal is reported here too: the confirmation should never be offered
	 * for a closure that cannot succeed.
	 */
	public async preview(req: Request, res: Response) {
		const preview = await this.service.previewClosure(req.genumMeta.ids.userID);
		res.status(statusFor(preview)).json(preview);
	}

	/** Close the caller's own account. Irreversible. */
	public async close(req: Request, res: Response) {
		const outcome = await this.service.closeAccount(req.genumMeta.ids.userID);
		res.status(statusFor(outcome)).json(outcome);
	}
}

/**
 * A refusal is a 409, not a 500: it needs a human decision, and its reason is
 * meant to be shown verbatim -- "transfer ownership of <org> first" is
 * actionable where "something went wrong" is not. A failed step is a 500,
 * because it needs a retry rather than a decision.
 */
function statusFor(result: ClosurePreview | ClosureOutcome): number {
	switch (result.status) {
		case "not_found":
			return 404;
		case "refused":
			return 409;
		case "failed":
			return 500;
		default:
			return 200;
	}
}
