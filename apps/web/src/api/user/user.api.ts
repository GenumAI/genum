import { apiClient, ApiRequestConfig } from "../client";
import { UserType } from "@/types/User";
import { OrganizationWithProjects } from "@/types/Organization";

// ============================================================================
// Types
// ============================================================================

export interface CurrentUser extends UserType {
	avatar?: string;
	picture?: string;
	isSystemUser?: boolean;
}

export type CurrentUserApiResponse = CurrentUser | { user: CurrentUser };

export interface Notification {
	id: string;
	title: string;
	content: string;
	type?: string;
	createdAt: string;
	read?: boolean;
}

export interface PaginationMeta {
	totalCount?: number;
	totalPages?: number;
	currentPage?: number;
}

export interface NotificationsListResponse {
	notifications: Notification[];
	pagination?: PaginationMeta;
	totalCount?: number;
}

export type NotificationApiResponse = Notification | { notification: Notification };

export interface GetNotificationsParams {
	page?: number;
	limit?: number;
}

export interface FeedbackPayload {
	type: string;
	subject: string;
	message: string;
}

export interface UpdateUserPayload {
	name?: string;
	[key: string]: any;
}

export interface CreateOrganizationPayload {
	name: string;
	description?: string;
}

export interface CreateOrganizationResponse {
	organization: OrganizationWithProjects;
}

export interface InviteValidationResponse {
	invite: {
		org_name: string;
		invite_valid: boolean;
		[key: string]: any;
	};
}

export interface AcceptInviteResponse {
	success: boolean;
	message?: string;
	member?: {
		id: number | string;
		organizationId: number | string;
		userId: number | string;
		role: string;
	};
	user?: {
		id: string;
		email: string;
		name: string;
	};
	organization?: {
		id: string | number;
		name: string;
	};
}

// ============================================================================
// Helpers
// ============================================================================

const extractUser = (data: CurrentUserApiResponse): CurrentUser => {
	if (typeof (data as { user?: CurrentUser }).user !== "undefined") {
		return (data as { user: CurrentUser }).user;
	}
	return data as CurrentUser;
};

const extractNotification = (data: NotificationApiResponse): Notification => {
	if (typeof (data as { notification?: Notification }).notification !== "undefined") {
		return (data as { notification: Notification }).notification;
	}
	return data as Notification;
};

const buildQueryString = (params?: GetNotificationsParams): string => {
	if (!params) {
		return "";
	}

	const searchParams = new URLSearchParams();
	if (typeof params.page !== "undefined") {
		searchParams.set("page", String(params.page));
	}
	if (typeof params.limit !== "undefined") {
		searchParams.set("limit", String(params.limit));
	}

	const queryString = searchParams.toString();
	return queryString ? `?${queryString}` : "";
};

// ============================================================================
// User API
// ============================================================================

export const userApi = {
	/**
	 * Get current user profile
	 */
	getCurrentUser: async (config?: ApiRequestConfig): Promise<CurrentUser> => {
		const response = await apiClient.get<CurrentUserApiResponse>("/user/me", config);
		return extractUser(response.data);
	},

	/**
	 * Get notifications list
	 */
	getNotifications: async (
		params?: GetNotificationsParams,
		config?: ApiRequestConfig,
	): Promise<NotificationsListResponse> => {
		const response = await apiClient.get<NotificationsListResponse>(
			`/user/notifications${buildQueryString(params)}`,
			config,
		);
		return response.data;
	},

	/**
	 * Get a single notification by ID
	 */
	getNotification: async (
		notificationId: string,
		config?: ApiRequestConfig,
	): Promise<Notification> => {
		const response = await apiClient.get<NotificationApiResponse>(
			`/user/notifications/${notificationId}`,
			config,
		);
		return extractNotification(response.data);
	},

	/**
	 * Mark all notifications as read
	 */
	markAllNotificationsAsRead: async (config?: ApiRequestConfig): Promise<void> => {
		await apiClient.post("/user/notifications/read-all", undefined, config);
	},

	/**
	 * Mark a single notification as read
	 */
	markNotificationAsRead: async (
		notificationId: string,
		config?: ApiRequestConfig,
	): Promise<void> => {
		await apiClient.post(`/user/notifications/${notificationId}/read`, undefined, config);
	},

	/**
	 * Update current user profile
	 */
	updateUser: async (
		data: UpdateUserPayload,
		config?: ApiRequestConfig,
	): Promise<CurrentUser> => {
		const response = await apiClient.put<CurrentUserApiResponse>("/user", data, config);
		return extractUser(response.data);
	},

	/**
	 * Send feedback
	 */
	sendFeedback: async (data: FeedbackPayload, config?: ApiRequestConfig): Promise<void> => {
		await apiClient.post("/user/feedback", data, config);
	},

	/**
	 * Create a new organization (system user only)
	 */
	createOrganization: async (
		data: CreateOrganizationPayload,
		config?: ApiRequestConfig,
	): Promise<CreateOrganizationResponse> => {
		const response = await apiClient.post<CreateOrganizationResponse>(
			"/system/organizations",
			data,
			config,
		);
		return response.data;
	},

	/**
	 * Validate invite by token
	 */
	getInviteByToken: async (
		token: string,
		config?: ApiRequestConfig,
	): Promise<InviteValidationResponse> => {
		const response = await apiClient.get<InviteValidationResponse>(
			`/user/invites/${token}`,
			config,
		);
		return response.data;
	},

	/**
	 * Accept invite by token
	 */
	acceptInvite: async (
		token: string,
		config?: ApiRequestConfig,
	): Promise<AcceptInviteResponse> => {
		const response = await apiClient.post<AcceptInviteResponse>(
			`/user/invites/${token}/accept`,
			undefined,
			config,
		);
		return response.data;
	},
};

// ============================================================================
// Account closure
// ============================================================================

/** Mirrors ClosurePreview / ClosureOutcome in apps/core. */
export type ClosureRefusal = {
	status: "refused";
	step: string;
	/** Machine-readable; shown as `detail`, which is written to be actionable. */
	reason: string;
	detail: string;
};

export type ClosurePreview =
	| { status: "erasable"; alreadyErased: boolean; labOnly: boolean }
	| ClosureRefusal;

export type ClosureOutcome =
	| {
			status: "closed";
			completed: string[];
			identitiesDeleted: number;
			alreadyErased: boolean;
			labOnly: boolean;
	  }
	| ClosureRefusal;

export const accountClosureApi = {
	/** Writes nothing. Safe to call whenever the dialog opens. */
	preview: async (): Promise<ClosurePreview> => {
		const response = await apiClient.get<ClosurePreview>("/user/closure/preview");
		return response.data;
	},

	/**
	 * Irreversible, and there is no cancel path.
	 *
	 * `password` is sent only on a self-hosted instance, where it replaces the
	 * identity provider's step-up. On a cloud instance the server refuses a
	 * password outright, so sending one would be pointless as well as wrong.
	 */
	close: async (password?: string): Promise<ClosureOutcome> => {
		const response = await apiClient.post<ClosureOutcome>(
			"/user/closure",
			password ? { password } : {},
		);
		return response.data;
	},
};
