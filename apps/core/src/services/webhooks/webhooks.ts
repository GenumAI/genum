import { env } from "@/env";
import axios from "axios";

async function sendEmail(to: string, url: string, organizationName: string) {
	const response = await axios.post(
		env.WEBHOOK_EMAIL_URL,
		{
			to,
			url,
			organizationName,
		},
		{
			auth: webhookAuth(),
		},
	);

	return response.data;
}

type Feedback = {
	type: string;
	subject: string;
	message: string;
	userID: number;
	userEmail: string;
	stage: string;
};
async function sendFeedback(feedback: {
	type: string;
	subject: string;
	message: string;
	userID: number;
	userEmail: string;
	stage: string;
}) {
	const response = await axios.post(
		env.WEBHOOK_FEEDBACK_URL,
		{
			message: formatFeedback(feedback),
		},
		{
			auth: webhookAuth(),
		},
	);

	return response.data;
}
function formatFeedback(feedback: Feedback) {
	return `📞 Feedback ${feedback.stage}\nType: ${feedback.type}\nUser: ${feedback.userEmail}(${feedback.userID})\nSubject: ${feedback.subject}\n\n${feedback.message}\n\nDate: ${new Date().toLocaleDateString("ru-RU")}`;
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
		await axios.post(
			env.WEBHOOK_NEW_USER_URL,
			{
				message: user,
			},
			{
				auth: webhookAuth(),
			},
		);
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
