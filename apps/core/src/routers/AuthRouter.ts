import { Router, type Request, type Response, type NextFunction } from "express";
import { AdminController } from "../controllers/admin.controller";
import { env } from "@/env";
import { asyncHandler } from "@/utils/asyncHandler";
import { extractBearerToken } from "@/utils/http";

export function createAdminRouter(): Router {
	const router = Router();
	const controller = new AdminController();

	// apply middleware to all routes
	router.use(checkApiKey);

	// Auth
	router.post("/new-user", asyncHandler(controller.createNewUser.bind(controller)));

	router.get("/report", asyncHandler(controller.report.bind(controller)));

	// notifications
	router.post("/notification", asyncHandler(controller.postNotification.bind(controller)));

	router.delete(
		"/expired-invites",
		asyncHandler(controller.deleteExpiredInvites.bind(controller)),
	);

	return router;
}

// Middleware to check API key
function checkApiKey(req: Request, res: Response, next: NextFunction): void {
	const apiKey = extractBearerToken(req.headers.authorization);
	if (!apiKey) {
		res.status(401).json({
			error: "Invalid or missing Authorization header. Expected: Bearer <token>",
		});
		return;
	}

	const expectedApiKey = env.AUTH0_ACTION_APIKEY || "";
	if (apiKey !== expectedApiKey) {
		res.status(401).json({ error: "Invalid API key" });
		return;
	}

	next();
}
