import "dotenv/config";
import { env } from "./env";
import express, { type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { requestLog } from "./utils/request-log";
import z, { ZodError } from "zod";
import { setupRoutes } from "./routes";
import { initSystemPromptsConfig } from "./ai/runner/run";
import { initializeClickHouse } from "./services/logger/init";
import { initializeSentry, captureSentryException } from "@/services/sentry/init";
import { corsOptions } from "@/utils/cors";

// Initialize Sentry instrumentation BEFORE creating Express app
initializeSentry();

const app = express();
const PORT = env.CORE_PORT;

app.use(express.json()); // Required to parse JSON bodies from requests
app.use(cookieParser()); // Required to parse cookies from requests
app.use(cors(corsOptions));

app.use((req, _res, next) => {
	// Log request information
	requestLog(req);
	next();
});

// setup routes
setupRoutes(app);

// 404 handler - if no route is found, return 404
app.use((_req, _res, next) => {
	next({
		statusCode: 404,
		message: "Not Found",
	});
});

// error handler
app.use((err: unknown, _req: Request, res: Response) => {
	if (err instanceof ZodError) {
		console.error("Zod Validation Error:", JSON.stringify(err, null, 2));
		captureSentryException(err, { error_type: "validation_error" });
		res.status(400).json({
			status: "error",
			statusCode: 400,
			message: "Validation failed",
			errors: z.treeifyError(err),
		});
		return;
	}

	const error = err as { statusCode?: number; message?: string; stack?: string };

	console.error(error.stack);
	captureSentryException(error, { error_type: "server_error" });

	const statusCode = error.statusCode || 500;
	const message = error.message || "Internal Server Error";

	res.status(statusCode).json({
		status: "error",
		statusCode,
		message,
	});
});

// initialize system prompts config and ClickHouse before starting server
Promise.all([initSystemPromptsConfig(), initializeClickHouse()])
	.then(() => {
		app.listen(PORT, () => {
			console.log(
				[
					`----SERVER IS RUNNING----`,
					`INSTANCE: ${env.INSTANCE_TYPE} VERSION: ${env.RELEASE_VERSION}`,
					`PORT: ${PORT}`,
					`STAGE: ${env.NODE_ENV}`,
				].join("\n"),
			);
		});
	})
	.catch((error) => {
		console.error("Failed to initialize:", error);
		process.exit(1);
	});
