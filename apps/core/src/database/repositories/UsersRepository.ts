import type { PrismaClient } from "@/prisma";
import type { UserUpdateType } from "@/services/validate";

export class UsersRepository {
	private prisma: PrismaClient;

	constructor(prisma: PrismaClient) {
		this.prisma = prisma;
	}

	public async createUser(
		email: string,
		name: string,
		authID: string,
		picture: string | undefined,
	) {
		const user = await this.prisma.user.create({
			data: {
				email,
				name,
				authID,
				picture,
			},
		});

		return user;
	}

	public async createLocalUser(email: string, name: string, passwordHash: string) {
		const existingUser = await this.prisma.user.findUnique({
			where: { email: email },
		});

		if (existingUser) {
			throw new Error("User already exists");
		}

		const user = await this.prisma.user.create({
			data: {
				email,
				name,
				authID: "",
			},
		});

		await this.prisma.userCredential.create({
			data: {
				userId: user.id,
				passwordHash: passwordHash,
			},
		});

		return user;
	}

	public async getLocalUserByEmail(email: string) {
		return await this.prisma.user.findUnique({
			where: { email: email },
			include: { userCredentials: true },
		});
	}

	public async updateUser(userId: number, data: UserUpdateType) {
		return await this.prisma.user.update({
			where: { id: userId },
			data,
		});
	}

	public async getUserByID(userId: number) {
		return await this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				email: true,
				name: true,
			},
		});
	}

	public async getUserContextByID(userId: number) {
		// use user.id to request related data
		const userData = await this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				email: true,
				name: true,
				picture: true,
				organizationMemberships: {
					include: {
						organization: {
							include: {
								projects: {
									where: {
										members: {
											some: { userId: userId },
										},
									},

									include: {
										members: {
											where: { userId: userId },
											select: { role: true },
										},
									},
								},
							},
						},
					},
				},
			},
		});

		if (!userData) {
			throw new Error("User not found");
		}

		return userData;
	}

	public async getUserProjectContext(userId: number, orgId: number, projId: number) {
		const userContext = await this.prisma.user.findUnique({
			where: { id: userId },
			include: {
				organizationMemberships: {
					where: { organizationId: orgId },
					include: { organization: true },
				},
				projectMemberships: {
					where: {
						projectId: projId,
						project: {
							is: { organizationId: orgId },
						},
					},
					include: { project: true },
				},
			},
		});

		return userContext;
	}

	public async getUserByEmail(email: string) {
		return await this.prisma.user.findUnique({
			where: { email },
		});
	}

	public async countUsersByDate(startDate: Date, endDate: Date) {
		return await this.prisma.user.count({
			where: {
				createdAt: {
					gte: startDate,
					lte: endDate,
				},
			},
		});
	}

	public async countUsers() {
		return await this.prisma.user.count();
	}

	public async countNonSystemUsers() {
		return await this.prisma.user.count({
			where: {
				email: {
					not: "SYSTEM_USER",
				},
			},
		});
	}

	public async getNotifications(userId: number, limit: number = 10, offset: number = 0) {
		const [notifications, totalCount] = await Promise.all([
			this.prisma.notification.findMany({
				orderBy: {
					createdAt: "desc",
				},
				take: limit,
				skip: offset,
				include: {
					NotificationRead: {
						where: {
							userId: userId,
						},
						select: {
							id: true,
						},
					},
				},
			}),
			this.prisma.notification.count(),
		]);

		// convert data, adding read field
		const notificationsWithReadStatus = notifications.map((notification) => ({
			...notification,
			read: notification.NotificationRead.length > 0,
			NotificationRead: undefined, // remove this field from result
		}));

		return {
			notifications: notificationsWithReadStatus,
			totalCount,
			totalPages: Math.ceil(totalCount / limit),
			currentPage: Math.floor(offset / limit) + 1,
		};
	}

	public async getNotificationById(id: string, userId: number) {
		const notification = await this.prisma.notification.findUnique({
			where: { id },
			include: {
				NotificationRead: {
					where: {
						userId: userId,
					},
					select: {
						id: true,
					},
				},
			},
		});

		if (!notification) {
			return null;
		}

		// Add read field and remove NotificationRead from result
		const { NotificationRead, ...rest } = notification;
		return {
			...rest,
			read: NotificationRead.length > 0,
		};
	}

	public async markNotificationAsRead(userId: number, notificationId: string) {
		return await this.prisma.notificationRead.upsert({
			where: {
				notificationId_userId: {
					notificationId: notificationId,
					userId: userId,
				},
			},
			update: {},
			create: {
				notificationId: notificationId,
				userId: userId,
			},
		});
	}

	public async markAllNotificationsAsRead(userId: number) {
		const unreadNotifications = await this.prisma.notification.findMany({
			where: {
				NotificationRead: {
					none: { userId },
				},
			},
			select: { id: true },
		});

		if (unreadNotifications.length === 0) {
			return { count: 0 };
		}

		return await this.prisma.notificationRead.createMany({
			data: unreadNotifications.map((notification) => ({
				userId,
				notificationId: notification.id,
			})),
		});
	}

	public async createNotification(title: string, content: string) {
		return await this.prisma.notification.create({
			data: {
				title,
				content,
			},
		});
	}

	public async createLocalUserSession(userId: number) {
		const SESSION_TTL_HOURS = 24;
		const now = new Date();
		const expiresAt = new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000);

		return await this.prisma.userSession.create({
			data: {
				userId: userId,
				expiresAt: expiresAt,
			},
		});
	}

	public async getLocalUserSessionById(id: string) {
		return await this.prisma.userSession.findUnique({
			where: { id: id },
			include: { user: true },
		});
	}

	public async deleteLocalUserSession(sessionId: string) {
		return await this.prisma.userSession.deleteMany({
			where: { id: sessionId },
		});
	}
}
