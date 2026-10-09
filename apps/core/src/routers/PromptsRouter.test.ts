import { describe, it, expect, vi } from "vitest";
import type { RequestHandler, Router } from "express";

vi.mock("@/env", () => ({
	env: { FRONTEND_URL: "https://lab.genum.ai", INSTANCE_TYPE: "local" },
}));

vi.mock("@/database/db", () => ({ db: {} }));

import { createPromptsRouter } from "./PromptsRouter";
import { PromptsController } from "../controllers/prompt.controller";
import { PromptVersionsController } from "../controllers/prompt-versions.controller";
import { PlaceholdersController } from "../controllers/placeholder.controller";
import { PromptModelsController } from "../controllers/prompt-models.controller";
import { PromptAssistantController } from "../controllers/prompt-assistant.controller";

type Layer = {
	route?: {
		path: string;
		methods: Record<string, boolean>;
		stack: { handle: RequestHandler & { __minRole?: string } }[];
	};
};

type Registered = { method: string; path: string; chain: RequestHandler[] };

function routesOf(router: Router): Registered[] {
	return (router.stack as Layer[])
		.filter((layer): layer is Required<Layer> => Boolean(layer.route))
		.map((layer) => ({
			method: Object.keys(layer.route.methods).find((m) => layer.route.methods[m]) ?? "",
			path: layer.route.path,
			chain: layer.route.stack.map((s) => s.handle),
		}));
}

/**
 * The whole surface, in registration order. Express 5 still matches layers in the order
 * they were added, so this list is both the inventory and the ordering contract -- the
 * two literal paths below sit in front of parameterised siblings that would otherwise
 * swallow them.
 */
const EXPECTED_ROUTES: [string, string][] = [
	["get", "/:id/agent"],
	["post", "/:id/agent/message"],
	["post", "/:id/agent/new-chat"],
	["post", "/:id/audit"],
	["post", "/:id/assertion"],
	["post", "/:id/json-schema"],
	["post", "/:id/tool"],
	["post", "/:id/input"],
	["get", "/models"],
	["get", "/models/:id"],
	["put", "/:id/config"],
	["patch", "/:id/model/:modelId"],
	["get", "/"],
	["post", "/"],
	["get", "/:id/placeholders"],
	["post", "/:id/placeholders"],
	["get", "/:id/placeholders/:placeholderId"],
	["put", "/:id/placeholders/:placeholderId"],
	["delete", "/:id/placeholders/:placeholderId"],
	["post", "/:id/placeholders/:placeholderId/values"],
	["put", "/:id/placeholders/:placeholderId/values/:valueId"],
	["delete", "/:id/placeholders/:placeholderId/values/:valueId"],
	["get", "/:id/logs"],
	["get", "/:id/logs/detail"],
	["post", "/:id/run"],
	["post", "/:id/commit"],
	["get", "/:id/commit/generate"],
	["get", "/:id/commit/:commitId"],
	["post", "/:id/commit/:commitId/rollback"],
	["get", "/:id/branches"],
	["get", "/:id/branches/:branch/commits"],
	["get", "/:id/testcases"],
	["get", "/:id"],
	["put", "/:id"],
	["delete", "/:id"],
];

function indexOf(routes: Registered[], method: string, path: string): number {
	const at = routes.findIndex((route) => route.method === method && route.path === path);
	if (at === -1) {
		throw new Error(`route ${method.toUpperCase()} ${path} is not registered`);
	}
	return at;
}

describe("createPromptsRouter — route surface", () => {
	it("registers exactly these routes, in this order", () => {
		const routes = routesOf(createPromptsRouter()).map(
			(route) => [route.method, route.path] as [string, string],
		);

		expect(routes).toEqual(EXPECTED_ROUTES);
	});

	it("puts GET /models in front of GET /:id", () => {
		// Both are one-segment GETs, so whichever is registered first wins: behind /:id,
		// the model list would be parsed as a prompt id and 400 on numberSchema.
		const routes = routesOf(createPromptsRouter());

		expect(indexOf(routes, "get", "/models")).toBeLessThan(indexOf(routes, "get", "/:id"));
	});

	it("puts GET /:id/commit/generate in front of GET /:id/commit/:commitId", () => {
		// Same shape, three segments each. Behind the parameterised one, "generate" would
		// be read as a commit id and the commit-message generator would be unreachable.
		const routes = routesOf(createPromptsRouter());

		expect(indexOf(routes, "get", "/:id/commit/generate")).toBeLessThan(
			indexOf(routes, "get", "/:id/commit/:commitId"),
		);
	});
});

describe("createPromptsRouter — guard chain", () => {
	it("carries no per-route guard on any route", () => {
		// Authorization here is two layers, neither of them on the route: routes.ts mounts
		// this router behind w.context("project"), and each handler then calls
		// checkPromptAccess to prove the prompt in the URL belongs to that project. A
		// route that grew a third, route-level guard -- or a project router pattern
		// copy-pasted in -- would show up as a longer chain here.
		const overGuarded = routesOf(createPromptsRouter())
			.filter((route) => route.chain.length !== 1)
			.map((route) => `${route.method.toUpperCase()} ${route.path}`);

		expect(overGuarded).toEqual([]);
	});

	it("wraps every handler in asyncHandler", () => {
		// asyncHandler returns an arity-3 (req, res, next) function; a bound controller
		// method is arity 2. An unwrapped async handler turns a thrown HttpError into an
		// unhandled rejection instead of a response, so this is the one property of the
		// chain worth pinning per route.
		const unwrapped = routesOf(createPromptsRouter())
			.filter((route) => route.chain[0].length !== 3)
			.map((route) => `${route.method.toUpperCase()} ${route.path}`);

		expect(unwrapped).toEqual([]);
	});
});

const CONTROLLERS = {
	PromptsController,
	PromptVersionsController,
	PlaceholdersController,
	PromptModelsController,
	PromptAssistantController,
};

const EXPECTED_HANDLERS: Record<string, string> = {
	"get /:id/agent": "PromptAssistantController.getChatMessages",
	"post /:id/agent/message": "PromptAssistantController.agent",
	"post /:id/agent/new-chat": "PromptAssistantController.newChatStart",
	"post /:id/audit": "PromptAssistantController.auditPrompt",
	"post /:id/assertion": "PromptAssistantController.editAssertion",
	"post /:id/json-schema": "PromptAssistantController.editJsonSchema",
	"post /:id/tool": "PromptAssistantController.editTool",
	"post /:id/input": "PromptAssistantController.generateInput",
	"get /models": "PromptModelsController.getModels",
	"get /models/:id": "PromptModelsController.getModelConfig",
	"put /:id/config": "PromptModelsController.saveModelConfig",
	"patch /:id/model/:modelId": "PromptModelsController.changePromptModel",
	"get /": "PromptsController.getProjectPrompts",
	"post /": "PromptsController.createPrompt",
	"get /:id/placeholders": "PlaceholdersController.getPlaceholdersByPromptId",
	"post /:id/placeholders": "PlaceholdersController.createPlaceholder",
	"get /:id/placeholders/:placeholderId": "PlaceholdersController.getPlaceholderById",
	"put /:id/placeholders/:placeholderId": "PlaceholdersController.updatePlaceholder",
	"delete /:id/placeholders/:placeholderId": "PlaceholdersController.deletePlaceholder",
	"post /:id/placeholders/:placeholderId/values": "PlaceholdersController.createPlaceholderValue",
	"put /:id/placeholders/:placeholderId/values/:valueId":
		"PlaceholdersController.updatePlaceholderValue",
	"delete /:id/placeholders/:placeholderId/values/:valueId":
		"PlaceholdersController.deletePlaceholderValue",
	"get /:id/logs": "PromptsController.getPromptLogs",
	"get /:id/logs/detail": "PromptsController.getPromptLogDetail",
	"post /:id/run": "PromptsController.runPrompt",
	"post /:id/commit": "PromptVersionsController.commitPrompt",
	"get /:id/commit/generate": "PromptVersionsController.generateCommit",
	"get /:id/commit/:commitId": "PromptVersionsController.getCommit",
	"post /:id/commit/:commitId/rollback": "PromptVersionsController.rollbackPrompt",
	"get /:id/branches": "PromptVersionsController.getBranches",
	"get /:id/branches/:branch/commits": "PromptVersionsController.getCommitsByBranch",
	"get /:id/testcases": "PromptsController.getTestcasesByPromptId",
	"get /:id": "PromptsController.getPromptById",
	"put /:id": "PromptsController.updatePrompt",
	"delete /:id": "PromptsController.deletePrompt",
};

describe("createPromptsRouter — handler binding", () => {
	it("binds every route to its controller method, on that controller's instance", () => {
		// Five controllers are bound by hand, and asyncHandler hides the bound method from
		// the route table, so a route wired to the wrong controller or method would pass
		// every test above. Spy on each prototype before the router binds it, then call
		// every route once and record which method ran and whether `this` was its own
		// controller ("?" if a method was bound to another controller's instance).
		const calls: string[] = [];
		for (const [name, controller] of Object.entries(CONTROLLERS)) {
			const proto = controller.prototype as unknown as Record<string, () => unknown>;
			for (const method of Object.getOwnPropertyNames(proto)) {
				if (method === "constructor") continue;
				vi.spyOn(proto, method).mockImplementation(function (this: unknown) {
					calls.push(`${this instanceof controller ? name : "?"}.${method}`);
				});
			}
		}

		try {
			const bound = routesOf(createPromptsRouter()).map((route) => {
				calls.length = 0;
				route.chain[0]({} as never, {} as never, () => {});
				return [`${route.method} ${route.path}`, calls.join(", ")];
			});

			expect(Object.fromEntries(bound)).toEqual(EXPECTED_HANDLERS);
		} finally {
			vi.restoreAllMocks();
		}
	});
});
