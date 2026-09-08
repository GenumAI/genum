import "dotenv/config";
import { env } from "./env";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { requestLog } from "./utils/request-log";
import { requestTiming } from "./middleware/request-timing";
import {
	createApiRateLimiter,
	createCredentialRateLimiter,
	createGlobalRateLimiter,
} from "./middleware/rate-limit";
import { setupRoutes } from "./routes";
import { initSystemPromptsConfig } from "./ai/runner/run";
import { initializeSentry } from "@/services/sentry/init";
import { corsOptions } from "@/utils/cors";
import { errorHandler } from "@/utils/errorHandler";
import { VERSION } from "@/constants/VERSION";

// Initialize Sentry instrumentation BEFORE creating Express app
initializeSentry();

const app = express();

// Times every response, so it runs ahead of anything that can end a request
// early: a CORS preflight, a 429, a body that blows the size limit.
app.use(requestTiming);

// Ahead of the limiters so a 429 still carries CORS headers and the browser can
// read it, instead of reporting an opaque network failure on the login form.
app.use(cors(corsOptions));

// How many reverse proxies stand in front of core, so req.ip is the client rather than whatever
// terminates the TCP connection. The default of 0 matches the shipped topology, where
// docker-compose publishes 3010 directly. Raise it to the exact hop count when deploying behind
// a proxy -- leave it at 0 there and every caller arrives wearing the proxy's address, which
// puts the whole deployment in one bucket and refuses the eleventh login by anybody.
app.set("trust proxy", env.TRUST_PROXY_HOPS);

const credentialLimiter = createCredentialRateLimiter();
app.use("/auth/local/login", credentialLimiter);
app.use("/auth/local/register", credentialLimiter);
app.use("/api/v1", createApiRateLimiter());
app.use(createGlobalRateLimiter());

// The unauthenticated surfaces carry credentials and small JSON documents; only
// the authenticated routes need the 50 MB cap. The first parser to run wins, so
// each scoped parser below shrinks the limit for its prefix and the global one
// then leaves those requests alone.
app.use("/auth/local", express.json({ limit: "100kb" }));
app.use("/auth", express.json({ limit: "1mb" }));
app.use("/admin", express.json({ limit: "1mb" }));
app.use("/service/mail", express.json({ limit: "1mb" }));

app.use(express.json({ limit: "50mb" })); // Required to parse JSON bodies from requests
app.use(cookieParser()); // Required to parse cookies from requests

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
