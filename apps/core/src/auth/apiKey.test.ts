import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveApiKey } from "./apiKey";
import { db } from "@/database/db";

vi.mock("@/database/db", () => ({
	db: {
		project: {
			getProjectApiKeyByToken: vi.fn(),
			getProjectbyApiKeyById: vi.fn(),
		},
	},
}));

const KEY = { id: 7, token: "tok" };
const PROJECT = { id: 3, orgId: 1 };

describe("resolveApiKey", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("refuses a request with no Authorization header", async () => {
		await expect(resolveApiKey(undefined)).rejects.toMatchObject({
			statusCode: 401,
			message: "Invalid or missing Authorization header. Expected: Bearer <token>",
		});
		// The database is never asked. A missing header is not a lookup that failed.
		expect(db.project.getProjectApiKeyByToken).not.toHaveBeenCalled();
	});

	it("refuses a header that is not Bearer", async () => {
		await expect(resolveApiKey("Basic abc")).rejects.toMatchObject({ statusCode: 401 });
	});

	it("refuses an unknown token", async () => {
		vi.mocked(db.project.getProjectApiKeyByToken).mockResolvedValue(null as never);

		await expect(resolveApiKey("Bearer nope")).rejects.toMatchObject({
			statusCode: 401,
			message: "Invalid API key",
		});
	});

	it("reports 404, not 401, when the key is good but its project is gone", async () => {
		// Different facts and different fixes: 401 tells the caller to check their key,
		// which would send them looking for a problem that is not theirs.
		vi.mocked(db.project.getProjectApiKeyByToken).mockResolvedValue(KEY as never);
		vi.mocked(db.project.getProjectbyApiKeyById).mockResolvedValue(null as never);

		await expect(resolveApiKey("Bearer tok")).rejects.toMatchObject({
			statusCode: 404,
			message: "Project not found",
		});
	});

	it("returns the key and its project for a good token", async () => {
		vi.mocked(db.project.getProjectApiKeyByToken).mockResolvedValue(KEY as never);
		vi.mocked(db.project.getProjectbyApiKeyById).mockResolvedValue(PROJECT as never);

		await expect(resolveApiKey("Bearer tok")).resolves.toEqual({
			project: PROJECT,
			key: KEY,
		});
		// Looked up BY THE KEY'S ID, not by the raw token: the token is a secret and the
		// id is what every other lookup here is keyed on.
		expect(db.project.getProjectbyApiKeyById).toHaveBeenCalledWith(KEY.id);
	});
});
