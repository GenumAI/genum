import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserService } from "./user.service";
import type { Database } from "@/database/db";

describe("UserService", () => {
	let userService: UserService;
	let mockDb: {
		users: {
			getUserContextByID: ReturnType<typeof vi.fn>;
		};
	};

	beforeEach(() => {
		mockDb = {
			users: {
				getUserContextByID: vi.fn(),
			},
		};
		userService = new UserService(mockDb as unknown as Database);
	});

	describe("getUserContext", () => {
		it("should correctly map raw database data to user context", async () => {
			const mockUserId = 1;
			const mockRawData = {
				id: mockUserId,
				email: "test@example.com",
				name: "Test User",
				picture: "http://example.com/pic.jpg",
				organizationMemberships: [
					{
						role: "ADMIN",
						organization: {
							id: 10,
							name: "Org 1",
							description: "Description 1",
							projects: [
								{
									id: 100,
									name: "Project 1",
									description: "Proj Desc 1",
									members: [{ role: "EDITOR" }],
								},
							],
						},
					},
				],
			};

			mockDb.users.getUserContextByID.mockResolvedValue(mockRawData);

			const result = await userService.getUserContext(mockUserId);

			// Check user base data
			expect(result.id).toBe(mockUserId);
			expect(result.email).toBe("test@example.com");
			expect(result.name).toBe("Test User");
			expect(result.picture).toBe("http://example.com/pic.jpg");

			// Check organizations mapping
			expect(result.organizations).toHaveLength(1);
			const org = result.organizations[0];
			expect(org.id).toBe(10);
			expect(org.name).toBe("Org 1");
			expect(org.role).toBe("ADMIN");

			// Check projects mapping within organization
			expect(org.projects).toHaveLength(1);

			// Project with member role
			expect(org.projects[0].id).toBe(100);
			expect(org.projects[0].role).toBe("EDITOR");

			// Ensure organizationMemberships was removed from the top level
			expect((result as any).organizationMemberships).toBeUndefined();
		});

		it("should throw error if repository throws error", async () => {
			mockDb.users.getUserContextByID.mockRejectedValue(new Error("User not found"));

			await expect(userService.getUserContext(1)).rejects.toThrow("User not found");
		});

		it("should handle user with no organizations", async () => {
			const mockRawData = {
				id: 1,
				email: "test@example.com",
				name: "Test User",
				organizationMemberships: [],
			};

			mockDb.users.getUserContextByID.mockResolvedValue(mockRawData);

			const result = await userService.getUserContext(1);

			expect(result.organizations).toEqual([]);
		});
	});
});
