import type { Request, Response } from "express";
import { db } from "@/database/db";
import { env } from "@/env";
import { AuthNewUserSchema, NewNotificationSchema } from "@/services/validate/types/auth.type";
import { countRunsByDate } from "@/services/logger";
import { webhooks } from "@/services/webhooks/webhooks";

export class AdminController {
	public async createNewUser(req: Request, res: Response) {
		const user = AuthNewUserSchema.parse(req.body.user);
		console.log("user:", user);

		const newUser = await db.users.createUser(user.email, user.name, user.authID, user.picture);
		await db.organization.createPersonalOrganization(newUser);

		console.log("user created:", newUser);

		// for post register webhook
		const registeredUser = {
			id: newUser.id,
			email: user.email,
			name: user.name,
			created_at: user.created_at,
			ip: user.ip,
			geo: user.geo,
			stage: env.NODE_ENV,
		};

		// todo
		// send new user to webhook.
		// avoid await to not block the request
		webhooks.postRegister(registeredUser);

		res.status(200).json({ id: newUser.id });
	}

	public async report(_req: Request, res: Response) {
		const today = new Date();
		const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000); // yesterday
		const users = await db.users.countUsersByDate(yesterday, today);
		const total_users = await db.users.countUsers();
		const prompts = await db.prompts.countPromptsByDate(yesterday, today);
		const total_prompts = await db.prompts.getLastPromptId();
		const testcases = await db.testcases.countTestcasesByDate(yesterday, today);
		const runs = await countRunsByDate(yesterday, today);

		const report = {
			users,
			total_users,
			prompts,
			total_prompts,
			testcases,
			runs,
		};

		res.status(200).json(report);
	}

	public async postNotification(req: Request, res: Response) {
		const notification = NewNotificationSchema.parse(req.body);
		const newNotification = await db.users.createNotification(
			notification.title,
			notification.content,
		);

		res.status(200).json({ id: newNotification.id });
	}

	public async deleteExpiredInvites(_req: Request, res: Response) {
		const deleted = await db.organization.deleteExpiredInvites();
		console.log(`Deleted ${deleted} expired invites`);

		res.status(200).json({ message: "Expired invites deleted successfully", deleted });
	}
}
