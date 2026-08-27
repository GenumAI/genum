import { describe, it, expect, vi } from "vitest";
import type { RequestHandler, Router } from "express";
import { ProjectRole } from "@/prisma";

vi.mock("@/env", () => ({
	env: { FRONTEND_URL: "https://lab.genum.ai", INSTANCE_TYPE: "local" },
}));

vi.mock("@/database/db", () => ({ db: {} }));

/**
 * Each guard is tagged so we can tell, per route, which minimum role was required.
 */
vi.mock("../auth/wizard", () => ({
	createAuthMiddleware: () => ({
		hasMinProjectRole: (role: string) => {
			const guard = (() => {}) as RequestHandler & { __minRole?: string };
			guard.__minRole = role;
			return guard;
		},
		hasMinOrgRole: (role: string) => {
			const guard = (() => {}) as RequestHandler & { __minRole?: string };
			guard.__minRole = role;
			return guard;
		},
	}),
}));

import { createProjectRouter } from "./ProjectRouter";

type Layer = {
	route?: {
		path: string;
		methods: Record<string, boolean>;
		stack: { handle: RequestHandler & { __minRole?: string } }[];
	};
};

function minRoleFor(router: Router, method: string, path: string): string | undefined {
	const layer = (router.stack as Layer[]).find(
		(l) => l.route?.path === path && l.route.methods[method],
	);
	if (!layer?.route) {
		throw new Error(`route ${method.toUpperCase()} ${path} is not registered`);
	}
	return layer.route.stack.map((s) => s.handle.__minRole).find(Boolean);
}

describe("createProjectRouter — project API key routes", () => {
	it("requires ADMIN to mint a project API key", () => {
		// A project API key authenticates the public API; a plain MEMBER must not be
		// able to issue one.
		expect(minRoleFor(createProjectRouter(), "post", "/api-keys")).toBe(ProjectRole.ADMIN);
	});

	it("requires ADMIN to revoke a project API key", () => {
		expect(minRoleFor(createProjectRouter(), "delete", "/api-keys/:apiKeyId")).toBe(
			ProjectRole.ADMIN,
		);
	});

	it("leaves listing keys open to any project member", () => {
		// The listing exposes only publicKey, never the secret.
		expect(minRoleFor(createProjectRouter(), "get", "/api-keys")).toBeUndefined();
	});

	it("keeps the existing ADMIN guard on member management", () => {
		expect(minRoleFor(createProjectRouter(), "post", "/members")).toBe(ProjectRole.ADMIN);
	});
});
