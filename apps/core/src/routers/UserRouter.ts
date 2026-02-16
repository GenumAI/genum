import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { asyncHandler } from "@/utils/asyncHandler";

export function createUserRouter(): Router {
	const router = Router();
	const userController = new UserController();

	// get user info including orgs, projects and roles
	router.get("/me", asyncHandler(userController.getUserContext.bind(userController)));

	router.get("/", asyncHandler(userController.getUser.bind(userController)));
	router.put("/", asyncHandler(userController.updateUser.bind(userController)));

	// accept organization invitation
	router.post(
		"/invites/:token/accept",
		asyncHandler(userController.acceptInvitation.bind(userController)),
	);
	router.get(
		"/invites/:token",
		asyncHandler(userController.getInvitationByToken.bind(userController)),
	);

	router.post("/feedback", asyncHandler(userController.createFeedback.bind(userController)));

	// notifications
	router.get(
		"/notifications",
		asyncHandler(userController.getNotifications.bind(userController)),
	);
	router.get(
		"/notifications/:id",
		asyncHandler(userController.getNotificationById.bind(userController)),
	);
	router.post(
		"/notifications/read-all",
		asyncHandler(userController.markAllNotificationsAsRead.bind(userController)),
	);
	router.post(
		"/notifications/:id/read",
		asyncHandler(userController.markNotificationAsRead.bind(userController)),
	);

	return router;
}
