import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { ClosureController } from "../controllers/closure.controller";
import { requireReauthentication } from "@/auth/reauthenticate";
import { asyncHandler } from "@/utils/asyncHandler";

export function createUserRouter(): Router {
	const router = Router();
	const userController = new UserController();
	const closureController = new ClosureController();

	// Account closure -- the caller's OWN account. The subject comes from the
	// verified token inside the controller, never from the body.
	//
	// The preview writes nothing and is deliberately NOT behind the
	// re-authentication guard: the UI has to show what will be deleted before it
	// can ask anyone to confirm, and it only ever reveals the caller's own data.
	// The closure itself is irreversible and has no cancel path, so it is.
	router.get("/closure/preview", asyncHandler(closureController.preview.bind(closureController)));
	router.post(
		"/closure",
		asyncHandler(requireReauthentication),
		asyncHandler(closureController.close.bind(closureController)),
	);

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
