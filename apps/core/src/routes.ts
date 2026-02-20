import type { Express } from "express";
import { createAuthMiddleware } from "./auth/wizard";
import { checkJwt } from "./auth/jwt";
import { createAdminRouter } from "./routers/AuthRouter";
import { createApiV1Router } from "./routers/ApiV1Router";
import { createUserRouter } from "./routers/UserRouter";
import { createPromptsRouter } from "./routers/PromptsRouter";
import { createTestcasesRouter } from "./routers/TestcasesRouter";
import { createOrganizationRouter } from "./routers/OrganizationRouter";
import { createProjectRouter } from "./routers/ProjectRouter";
import { createHelpersRouter } from "./routers/HelpersRouter";
import { createLocalUserRouter } from "./routers/LocalUserRouter";
import { createFileRouter } from "./routers/FileRouter";
import { createSystemRouter } from "./routers/SystemRouter";

export function setupRoutes(app: Express): void {
	const w = createAuthMiddleware();

	// auth
	app.use(`/auth/local`, createLocalUserRouter());
	app.use(`/auth`, createAdminRouter());
	app.use(`/admin`, createAdminRouter());

	// api
	app.use(`/api/v1`, createApiV1Router());

	// secure only
	app.use(checkJwt); // check jwt token
	app.use(`/user`, ...w.context("user"), createUserRouter());
	app.use(`/prompts`, ...w.context("project"), createPromptsRouter());
	app.use(`/testcases`, ...w.context("project"), createTestcasesRouter());
	app.use(`/organization`, ...w.context("org"), createOrganizationRouter());
	app.use(`/project`, ...w.context("project"), createProjectRouter());
	app.use(`/helpers`, ...w.context("project"), createHelpersRouter());
	app.use(`/files`, ...w.context("project"), createFileRouter());
	app.use(`/system`, ...w.context("user"), w.requireSystemUser, createSystemRouter());
}
