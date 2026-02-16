import type { Express } from "express";
import { createAuthMiddleware } from "./auth/wizard";
import { checkJwt } from "./auth/jwt";
import { createAuthRouter } from "./routers/AuthRouter";
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
	app.use(`/auth`, createAuthRouter());

	// api
	app.use(`/api/v1`, createApiV1Router());

	// secure only
	app.use(checkJwt); // check jwt token
	app.use(`/user`, w.attachUserContext(), createUserRouter());
	app.use(
		`/prompts`,
		w.attachUserContext(),
		w.attachOrgContext(),
		w.attachProjContext(),
		createPromptsRouter(),
	);
	app.use(
		`/testcases`,
		w.attachUserContext(),
		w.attachOrgContext(),
		w.attachProjContext(),
		createTestcasesRouter(),
	);
	app.use(
		`/organization`,
		w.attachUserContext(),
		w.attachOrgContext(),
		createOrganizationRouter(),
	);
	app.use(
		`/project`,
		w.attachUserContext(),
		w.attachOrgContext(),
		w.attachProjContext(),
		createProjectRouter(),
	);
	app.use(
		`/helpers`,
		w.attachUserContext(),
		w.attachOrgContext(),
		w.attachProjContext(),
		createHelpersRouter(),
	);
	app.use(
		`/files`,
		w.attachUserContext(),
		w.attachOrgContext(),
		w.attachProjContext(),
		createFileRouter(),
	);
	app.use(`/system`, w.attachUserContext(), w.requireSystemUser(), createSystemRouter());
}
