import { Router, type Request, type Response, type NextFunction } from "express";
import { AdminController } from "../controllers/admin.controller";
import { env } from "@/env";
import { asyncHandler } from "@/utils/asyncHandler";

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
	const authHeader = req.headers.authorization;
	if (!authHeader) {
		res.status(401).json({ error: "Authorization header is missing" });
		return;
	}

	const parts = authHeader.split(" ");
	if (parts.length !== 2 || parts[0] !== "Bearer") {
		res.status(401).json({ error: "Invalid authorization header format" });
		return;
	}

	const apiKey = parts[1];
	const expectedApiKey = env.AUTH0_ACTION_APIKEY || "";

	if (apiKey !== expectedApiKey) {
		res.status(401).json({ error: "Invalid API key" });
		return;
	}

	next();
}
