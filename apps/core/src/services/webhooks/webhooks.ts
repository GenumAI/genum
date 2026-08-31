import { env } from "@/env";
import axios from "axios";

type WebhookPayload =
	| {
			type: "orgInviteEmail";
			data: { to: string; url: string; organizationName: string };
	  }
	| {
			type: "sendFeedback";
			data: {
				type: string;
				subject: string;
				message: string;
				userID: number;
				userEmail: string;
				stage: string;
			};
	  }
	| {
			type: "accountClosureNotice";
			data: { to: string; stage: string };
	  }
	| {
			type: "postRegister";
			data: {
				id: number;
				email: string;
				name: string;
				created_at: string;
				ip?: string;
				geo?: string;
				stage: string;
			};
	  };

async function send(payload: WebhookPayload) {
	if (!env.WEBHOOK_URL) return;

	const response = await axios.post(env.WEBHOOK_URL, payload, {
		auth: webhookAuth(),
	});

	return response.data;
}

async function sendEmail(to: string, url: string, organizationName: string) {
	return send({ type: "orgInviteEmail", data: { to, url, organizationName } });
}

async function sendFeedback(feedback: {
	type: string;
	subject: string;
	message: string;
	userID: number;
	userEmail: string;
	stage: string;
}) {
	return send({ type: "sendFeedback", data: feedback });
}

/**
 * Tell a person their account is being closed, while the address is still theirs.
 *
 * Sent BEFORE anything is written, for two reasons. The tombstone overwrites
 * `User.email` with `erased-<id>@erased.invalid`, so afterwards there is nobody
 * left to write to; and a closure has no grace period, so this notice cannot
 * undo anything — it is how a person finds out an account was destroyed without
 * them, which only works if it goes out.
 *
 * Best-effort, like `postRegister` and unlike `sendEmail`. A closure that aborted
 * because a notification failed would be the worse outcome: the caller reports
 * whether this landed, so a failure is visible without being able to strand a
 * half-closed account.
 */
async function accountClosureNotice(notice: { to: string; stage: string }): Promise<boolean> {
	// `send` returns early on an unset WEBHOOK_URL without throwing, so a bare
	// try/catch would report a delivered notice on a self-hosted instance that has
	// no consumer at all — the exact silent success this feature exists to prevent.
	if (!env.WEBHOOK_URL) return false;
	try {
		await send({ type: "accountClosureNotice", data: notice });
		return true;
	} catch (error) {
		console.error("accountClosureNotice failed:", error);
		return false;
	}
}

async function postRegister(user: {
	id: number;
	email: string;
	name: string;
	created_at: string;
	ip?: string;
	geo?: string;
	stage: string;
}) {
	try {
		await send({ type: "postRegister", data: user });
	} catch (error) {
		console.error(error);
	}
}

function webhookAuth() {
	return {
		username: env.WEBHOOK_USERNAME,
		password: env.WEBHOOK_PASSWORD,
	};
}

export const webhooks = {
	sendEmail,
	sendFeedback,
	postRegister,
	accountClosureNotice,
};
