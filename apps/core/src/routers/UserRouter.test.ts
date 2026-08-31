import { describe, it, expect, vi } from "vitest";
import type { Router, RequestHandler } from "express";

vi.mock("@/env", () => ({ env: { INSTANCE_TYPE: "cloud" } }));
vi.mock("@/database/db", () => ({ db: {} }));
vi.mock("@/services/mail-erasure-client", () => ({ MailErasureClient: class {} }));

const requireReauthentication = vi.hoisted(() => vi.fn());
vi.mock("@/auth/reauthenticate", () => ({ requireReauthentication }));

import { createUserRouter } from "./UserRouter";

type Layer = {
	route?: {
		path: string;
		methods: Record<string, boolean>;
		stack: { handle: RequestHandler; name?: string }[];
	};
};

function handlerCount(router: Router, method: string, path: string): number {
	const layer = (router.stack as Layer[]).find(
		(l) => l.route?.path === path && l.route.methods[method],
	);
	if (!layer?.route) {
		throw new Error(`route ${method.toUpperCase()} ${path} is not registered`);
	}
	return layer.route.stack.length;
}

describe("createUserRouter — account closure routes", () => {
	it("guards the closure with re-authentication", () => {
		// Two handlers: the guard, then the controller. One would mean the guard
		// is gone and an irreversible action runs on a token the caller merely
		// still holds.
		expect(handlerCount(createUserRouter(), "post", "/closure")).toBe(2);
	});

	it("leaves the preview ungated so the UI can show the consequences first", () => {
		expect(handlerCount(createUserRouter(), "get", "/closure/preview")).toBe(1);
	});

	it("registers no other closure route", () => {
		// There is no grace period and no cancel path; nothing should offer one.
		const paths = (createUserRouter().stack as Layer[])
			.map((l) => l.route?.path)
			.filter((p): p is string => typeof p === "string" && p.includes("closure"));

		expect(paths.sort()).toEqual(["/closure", "/closure/preview"]);
	});
});
