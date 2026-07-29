import { describe, it, expect, vi, beforeEach } from "vitest";
import { MailOnboardingService } from "./mailservice.service";
import type { Database } from "@/database/db";

function makeMockDb() {
	return {
		users: {
			getUserByAuthID: vi.fn(),
			getUserContextByID: vi.fn(),
		},
		organization: {
			getMemberByUserId: vi.fn(),
		},
		project: {
			findProjectByOrgAndName: vi.fn(),
			getMemberByUserId: vi.fn(),
			createSharedProject: vi.fn(),
			addMember: vi.fn(),
			newProjectApiKey: vi.fn(),
		},
	};
}

const USER = { id: 7, authID: "auth0|abc", email: "u@x.com", name: "U" };

describe("MailOnboardingService.getContext", () => {
	let mockDb: ReturnType<typeof makeMockDb>;
	let service: MailOnboardingService;

	beforeEach(() => {
		mockDb = makeMockDb();
		service = new MailOnboardingService(mockDb as unknown as Database);
	});

	it("returns null for an unknown sub", async () => {
		mockDb.users.getUserByAuthID.mockResolvedValue(null);
		expect(await service.getContext("auth0|nope")).toBeNull();
	});

	it("maps memberships to the wire shape", async () => {
		mockDb.users.getUserByAuthID.mockResolvedValue(USER);
		mockDb.users.getUserContextByID.mockResolvedValue({
			id: 7,
			organizationMemberships: [
				{
					role: "OWNER",
					organization: {
						id: 1,
						name: "Personal",
						personal: true,
						projects: [{ id: 10, name: "Mail", members: [{ role: "ADMIN" }] }],
					},
				},
			],
		});
		expect(await service.getContext("auth0|abc")).toEqual({
			user: { id: 7 },
			organizations: [
				{
					id: 1,
					name: "Personal",
					personal: true,
					role: "OWNER",
					projects: [{ id: 10, name: "Mail" }],
				},
			],
		});
	});
});

describe("MailOnboardingService.createProject", () => {
	let mockDb: ReturnType<typeof makeMockDb>;
	let service: MailOnboardingService;

	beforeEach(() => {
		mockDb = makeMockDb();
		service = new MailOnboardingService(mockDb as unknown as Database);
		mockDb.users.getUserByAuthID.mockResolvedValue(USER);
	});

	it("refuses when the user is not in the org", async () => {
		mockDb.organization.getMemberByUserId.mockResolvedValue(null);
		expect(await service.createProject("auth0|abc", 1, "Mail")).toEqual({
			ok: false,
			reason: "forbidden",
		});
	});

	it("refuses org role READER", async () => {
		mockDb.organization.getMemberByUserId.mockResolvedValue({ role: "READER" });
		expect(await service.createProject("auth0|abc", 1, "Mail")).toEqual({
			ok: false,
			reason: "forbidden",
		});
	});

	it("returns an existing project by (orgId, name) without creating", async () => {
		mockDb.organization.getMemberByUserId.mockResolvedValue({ role: "ADMIN" });
		mockDb.project.findProjectByOrgAndName.mockResolvedValue({ id: 10, name: "Mail" });
		mockDb.project.getMemberByUserId.mockResolvedValue({ role: "ADMIN" });
		expect(await service.createProject("auth0|abc", 1, "Mail")).toEqual({
			ok: true,
			projectId: 10,
			created: false,
		});
		expect(mockDb.project.createSharedProject).not.toHaveBeenCalled();
	});

	it("re-adds membership when the project exists but the user fell out of it", async () => {
		mockDb.organization.getMemberByUserId.mockResolvedValue({ role: "OWNER" });
		mockDb.project.findProjectByOrgAndName.mockResolvedValue({ id: 10, name: "Mail" });
		mockDb.project.getMemberByUserId.mockResolvedValue(null);
		const result = await service.createProject("auth0|abc", 1, "Mail");
		expect(result).toEqual({ ok: true, projectId: 10, created: false });
		expect(mockDb.project.addMember).toHaveBeenCalledWith(10, 7, "ADMIN");
	});

	it("creates a fresh project", async () => {
		mockDb.organization.getMemberByUserId.mockResolvedValue({ role: "ADMIN" });
		mockDb.project.findProjectByOrgAndName.mockResolvedValue(null);
		mockDb.project.createSharedProject.mockResolvedValue({ id: 42 });
		expect(await service.createProject("auth0|abc", 1, "Mail")).toEqual({
			ok: true,
			projectId: 42,
			created: true,
		});
	});
});

describe("MailOnboardingService.mintProjectApiKey", () => {
	let mockDb: ReturnType<typeof makeMockDb>;
	let service: MailOnboardingService;

	beforeEach(() => {
		mockDb = makeMockDb();
		service = new MailOnboardingService(mockDb as unknown as Database);
		mockDb.users.getUserByAuthID.mockResolvedValue(USER);
	});

	it("refuses a non-member", async () => {
		mockDb.project.getMemberByUserId.mockResolvedValue(null);
		expect(await service.mintProjectApiKey("auth0|abc", 10, "Mail — acme")).toEqual({
			ok: false,
			reason: "forbidden",
		});
	});

	it("mints and returns the raw key", async () => {
		mockDb.project.getMemberByUserId.mockResolvedValue({ role: "MEMBER" });
		mockDb.project.newProjectApiKey.mockResolvedValue({ id: 1, key: "deadbeef" });
		expect(await service.mintProjectApiKey("auth0|abc", 10, "Mail — acme")).toEqual({
			ok: true,
			key: "deadbeef",
		});
		expect(mockDb.project.newProjectApiKey).toHaveBeenCalledWith(10, "Mail — acme", 7);
	});
});
