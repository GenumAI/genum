import type { NextFunction, Request, Response } from "express";
import { z, ZodError } from "zod";
import { env } from "@/env";
import { captureSentryException, captureSentryMessage } from "@/services/sentry/init";

/**
 * Global Express error handler.
 *
 * Errors carrying a 4xx status are answered as such and deliberately kept out of
 * Sentry and the error log: a request for a prompt the caller may not see is a
 * client mistake, not a server fault, and reporting those buries real incidents.
 */
export function errorHandler(
	err: unknown,
	_req: Request,
	res: Response,
	_next: NextFunction,
): void {
	if (err instanceof ZodError) {
		console.error("Zod Validation Error:", JSON.stringify(err, null, 2));
		captureSentryMessage("Zod Validation Error", { error_type: "validation_error" });
		res.status(400).json({
			status: "error",
			statusCode: 400,
			message: "Validation failed",
			// only include errors in development
			...(env.NODE_ENV !== "production" ? { errors: z.treeifyError(err) } : {}),
		});
		return;
	}

	const error = err as { statusCode?: number; message?: string; stack?: string };
	const statusCode = error.statusCode || 500;
	const message = error.message || "Internal Server Error";

	const isClientError = statusCode >= 400 && statusCode < 500;
	if (!isClientError) {
		console.error(error.stack);
		captureSentryException(error, { error_type: "server_error" });
	}

	res.status(statusCode).json({
		status: "error",
		statusCode,
		message,
	});
}
