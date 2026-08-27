import "dotenv/config";
import { env } from "./env";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { requestLog } from "./utils/request-log";
import { setupRoutes } from "./routes";
import { initSystemPromptsConfig } from "./ai/runner/run";
import { initializeSentry } from "@/services/sentry/init";
import { corsOptions } from "@/utils/cors";
import { errorHandler } from "@/utils/errorHandler";
import { VERSION } from "@/constants/VERSION";

// Initialize Sentry instrumentation BEFORE creating Express app
initializeSentry();

const app = express();

app.use(express.json({ limit: "50mb" })); // Required to parse JSON bodies from requests
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
app.use(errorHandler);

// Load runtime configuration (system prompts from DB) before starting server
// Note: Database and ClickHouse initialization should be done via `pnpm run db-init` before starting the server
initSystemPromptsConfig()
	.then(() => {
		app.listen(env.CORE_PORT, () => {
			console.log(
				[
					`----SERVER IS RUNNING----`,
					`INSTANCE: ${env.INSTANCE_TYPE} VERSION: ${VERSION}`,
					`PORT: ${env.CORE_PORT}`,
					`STAGE: ${env.NODE_ENV}`,
				].join("\n"),
			);
		});
	})
	.catch((error) => {
		console.error("Failed to initialize system prompts config:", error);
		process.exit(1);
	});
