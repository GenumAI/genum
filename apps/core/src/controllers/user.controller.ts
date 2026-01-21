import type { Request, Response } from "express";
import { db } from "@/database/db";
import { OrganizationCreateSchema, stringSchema } from "@/services/validate";
import { FeedbackCreateSchema, UserUpdateSchema } from "@/services/validate/types/user.type";
import { env } from "@/env";
import { webhooks } from "@/services/webhooks/webhooks";
import { OrganizationService } from "@/services/organization.service";
import { UserService } from "@/services/user.service";

export class UserController {
	private readonly organizationService: OrganizationService;
	private readonly userService: UserService;

	constructor() {
		this.organizationService = new OrganizationService(db);
		this.userService = new UserService(db);
	}

	private getNotificationId(req: Request): string {
		return stringSchema.parse(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
	}

	public async getUserContext(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		const user = await this.userService.getUserContext(metadata.userID);

		res.status(200).json({ user: user });
	}

	public async getUser(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		const user = await db.users.getUserByID(metadata.userID);

		res.status(200).json({ user: user });
	}
	public async updateUser(req: Request, res: Response) {
		const user = req.genumMeta.user;

		const data = UserUpdateSchema.parse(req.body);

		const updatedUser = await db.users.updateUser(user.id, data);

		res.status(200).json({ user: updatedUser });
	}

	public async acceptInvitation(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const user = req.genumMeta.user;
		const token = stringSchema.parse(req.params.token);

		const invitation = await db.organization.getInvitationByToken(token);

		if (!invitation) {
			res.status(404).json({ error: "Invitation is not found" });
			return;
		}

		if (invitation.email !== user.email && invitation.expiresAt < new Date()) {
			res.status(400).json({ error: "Invitation is not found or expired" });
			return;
		}

		const member = await this.organizationService.addOrganizationMember(
			invitation.organizationId,
			metadata.userID,
			invitation.role,
		);

		await db.organization.deleteInvitation(token);

		res.status(200).json({ member });
	}

	public async getInvitationByToken(req: Request, res: Response) {
		const user = req.genumMeta.user;
		const token = stringSchema.parse(req.params.token);

		const invite = await db.organization.getInvitationByToken(token);

		// check if invite is found and email matches
		if (!invite || invite.email !== user.email) {
			res.status(404).json({ error: "Invitation not found" });
			return;
		}

		const invite_data = {
			org_name: invite.organization.name,
			invite_valid: true,
		};

		res.status(200).json({
			invite: invite_data,
		});
	}

	public async createOrganization(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const data = OrganizationCreateSchema.parse(req.body);

		const organization = await db.organization.createSharedOrganization(
			data.name,
			data.description,
			metadata.userID,
		);

		res.status(200).json({
			organization,
		});
	}

	public async createFeedback(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const data = FeedbackCreateSchema.parse(req.body);

		const user = await db.users.getUserByID(metadata.userID);

		if (!user) {
			res.status(404).json({ error: "User not found" });
			return;
		}

		await webhooks.sendFeedback({
			type: data.type,
			subject: data.subject,
			message: data.message,
			userID: metadata.userID,
			userEmail: user.email,
			stage: env.NODE_ENV,
		});

		res.status(200).json({ ok: true });
	}

	public async getNotifications(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		// Получаем параметры пагинации из query
		const page = parseInt(req.query.page as string, 10) || 1;
		const limit = parseInt(req.query.limit as string, 10) || 10;

		// Валидация параметров
		if (page < 1) {
			res.status(400).json({ error: "Page must be greater than 0" });
			return;
		}

		if (limit < 1 || limit > 100) {
			res.status(400).json({ error: "Limit must be between 1 and 100" });
			return;
		}

		const offset = (page - 1) * limit;
		const result = await db.users.getNotifications(metadata.userID, limit, offset);

		res.status(200).json({
			notifications: result.notifications,
			pagination: {
				currentPage: result.currentPage,
				totalPages: result.totalPages,
				totalCount: result.totalCount,
			},
		});
	}

	public async getNotificationById(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const notificationId = this.getNotificationId(req);
		const notification = await db.users.getNotificationById(notificationId, metadata.userID);
		res.status(200).json({ notification });
	}

	public async markNotificationAsRead(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const notificationId = this.getNotificationId(req);
		await db.users.markNotificationAsRead(metadata.userID, notificationId);
		res.status(200).json({ ok: true });
	}

	public async markAllNotificationsAsRead(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		await db.users.markAllNotificationsAsRead(metadata.userID);
		res.status(200).json({ ok: true });
	}
}
