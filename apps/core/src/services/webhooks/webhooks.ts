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
};
