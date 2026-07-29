import { Router, type NextFunction, type Request, type Response } from "express";
import { MailServiceController } from "../controllers/mailservice.controller";
import { env } from "@/env";
import { asyncHandler } from "@/utils/asyncHandler";
import { extractBearerToken } from "@/utils/http";

/**
 * Static-bearer guard for the mail-client service integration. Unset env key
 * means the router is disabled: nothing can match, every request is 401.
 */
export function checkMailServiceKey(req: Request, res: Response, next: NextFunction): void {
	const configured = env.MAIL_SERVICE_APIKEY;
	const token = extractBearerToken(req.headers.authorization);
	if (!configured || !token || token !== configured) {
		res.status(401).json({ error: "Unauthorized" });
		return;
	}
	next();
}

export function createMailServiceRouter(): Router {
	const router = Router();
	const controller = new MailServiceController();

	router.use(checkMailServiceKey);

	router.get("/users/:sub/context", asyncHandler(controller.getContext.bind(controller)));
	router.post("/projects", asyncHandler(controller.createProject.bind(controller)));
	router.post("/project-api-keys", asyncHandler(controller.mintProjectApiKey.bind(controller)));

	return router;
}
