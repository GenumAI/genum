import { describe, it, expect, vi, beforeEach } from "vitest";
import { ErasureService } from "./erasure.service";
import type { Database } from "@/database/db";
import type { LabErasureSubject } from "@/erasure/decide-user-erasure";

function makeMockDb() {
	return {
		erasure: {
			getErasureSubject: vi.fn(),
			previewErasure: vi.fn(),
			eraseUser: vi.fn(),
		},
	};
}

function subject(over: Partial<LabErasureSubject> = {}): LabErasureSubject {
	return {
		userId: 42,
		email: "a.person@example.com",
		erasedAt: null,
		systemUserId: 1,
		organizations: [{ organizationId: 1, role: "OWNER", ownerCount: 1, memberCount: 1 }],
		...over,
	};
}

const COUNTS = {
	rowsDeleted: { UserSession: 2, UserCredential: 1, PromptChat: 0, NotificationRead: 5 },
	invitationsDeleted: 1,
	organizationDescriptionsRewritten: 1,
	projectDescriptionsRewritten: 1,
};

describe("ErasureService", () => {
	let mockDb: ReturnType<typeof makeMockDb>;
	let service: ErasureService;

	beforeEach(() => {
		mockDb = makeMockDb();
		service = new ErasureService(mockDb as unknown as Database);
	});

	it("reports not_found for an unknown user without touching anything", async () => {
		mockDb.erasure.getErasureSubject.mockResolvedValue(null);

		expect(await service.eraseUser(1)).toEqual({ status: "not_found" });
		expect(mockDb.erasure.eraseUser).not.toHaveBeenCalled();
	});

	it("refuses without writing when the guard refuses", async () => {
		mockDb.erasure.getErasureSubject.mockResolvedValue(
			subject({ organizations: [{ organizationId: 9, role: "OWNER", ownerCount: 1, memberCount: 4 }] }),
		);

		const outcome = await service.eraseUser(42);

		expect(outcome).toMatchObject({ status: "refused", reason: "sole_owner_of_shared_organization" });
		expect(mockDb.erasure.eraseUser).not.toHaveBeenCalled();
	});

	it("previews without writing", async () => {
		mockDb.erasure.getErasureSubject.mockResolvedValue(subject());
		mockDb.erasure.previewErasure.mockResolvedValue(COUNTS);

		const outcome = await service.previewErasure(42);

		expect(outcome).toEqual({ status: "erasable", alreadyErased: false, counts: COUNTS });
		expect(mockDb.erasure.eraseUser).not.toHaveBeenCalled();
	});

	it("erases with the subject's CURRENT address, not the caller's", async () => {
		// The invitations and the two description columns are found by the
		// pre-tombstone address. Reading it from the row rather than from the
		// caller is what keeps a re-run from searching for the wrong string.
		mockDb.erasure.getErasureSubject.mockResolvedValue(subject({ email: "real@example.com" }));
		mockDb.erasure.eraseUser.mockResolvedValue(COUNTS);

		const outcome = await service.eraseUser(42);

		expect(mockDb.erasure.eraseUser).toHaveBeenCalledWith(42, "real@example.com");
		expect(outcome).toEqual({ status: "erased", alreadyErased: false, counts: COUNTS });
	});

	it("re-runs a half-finished closure instead of failing it", async () => {
		mockDb.erasure.getErasureSubject.mockResolvedValue(subject({ erasedAt: new Date("2026-08-31") }));
		mockDb.erasure.eraseUser.mockResolvedValue(COUNTS);

		const outcome = await service.eraseUser(42);

		expect(outcome).toMatchObject({ status: "erased", alreadyErased: true });
		expect(mockDb.erasure.eraseUser).toHaveBeenCalled();
	});

	it("refuses the system account on both entry points", async () => {
		mockDb.erasure.getErasureSubject.mockResolvedValue(subject({ userId: 1, systemUserId: 1 }));

		expect(await service.previewErasure(1)).toMatchObject({ status: "refused", reason: "system_user" });
		expect(await service.eraseUser(1)).toMatchObject({ status: "refused", reason: "system_user" });
		expect(mockDb.erasure.eraseUser).not.toHaveBeenCalled();
		expect(mockDb.erasure.previewErasure).not.toHaveBeenCalled();
	});
});
