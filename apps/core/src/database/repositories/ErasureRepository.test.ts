import { describe, it, expect, vi, beforeEach } from "vitest";
import { ErasureRepository } from "./ErasureRepository";
import type { SystemRepository } from "./SystemRepository";
import type { PrismaClient } from "@/prisma";

/** Records the order calls arrive in, which is what most of these tests assert. */
type Trace = string[];

function makeMockPrisma(trace: Trace) {
	const deleteMany = (label: string, count: number) =>
		vi.fn(() => {
			trace.push(label);
			return { count };
		});

	return {
		user: {
			findUnique: vi.fn(),
			update: vi.fn((args: unknown) => {
				trace.push("user.update");
				return args;
			}),
		},
		organizationMember: { groupBy: vi.fn().mockResolvedValue([]) },
		organizationInvitation: {
			count: vi.fn().mockResolvedValue(0),
			deleteMany: vi.fn(async () => {
				trace.push("invitation.deleteMany");
				return { count: 1 };
			}),
		},
		organization: {
			findMany: vi.fn().mockResolvedValue([]),
			update: vi.fn(async () => {
				trace.push("organization.update");
			}),
		},
		project: {
			findMany: vi.fn().mockResolvedValue([]),
			update: vi.fn(async () => {
				trace.push("project.update");
			}),
		},
		userSession: { count: vi.fn().mockResolvedValue(2), deleteMany: deleteMany("UserSession", 2) },
		userCredential: { count: vi.fn().mockResolvedValue(1), deleteMany: deleteMany("UserCredential", 1) },
		promptChat: { count: vi.fn().mockResolvedValue(3), deleteMany: deleteMany("PromptChat", 3) },
		notificationRead: { count: vi.fn().mockResolvedValue(5), deleteMany: deleteMany("NotificationRead", 5) },
		$transaction: vi.fn(async (ops: unknown[]) => {
			trace.push("$transaction");
			return ops;
		}),
	};
}

function makeMockSystem(systemUserId: number | null = 1) {
	return { getSystemUserId: vi.fn().mockResolvedValue(systemUserId) };
}

function build(trace: Trace = []) {
	const prisma = makeMockPrisma(trace);
	const system = makeMockSystem();
	const repo = new ErasureRepository(prisma as unknown as PrismaClient, system as unknown as SystemRepository);
	return { repo, prisma, system, trace };
}

describe("ErasureRepository.getErasureSubject", () => {
	it("returns null for an unknown id", async () => {
		const { repo, prisma } = build();
		prisma.user.findUnique.mockResolvedValue(null);

		expect(await repo.getErasureSubject(42)).toBeNull();
	});

	it("folds the grouped counts into per-organization owner and member totals", async () => {
		const { repo, prisma } = build();
		prisma.user.findUnique.mockResolvedValue({
			id: 42,
			email: "a.person@example.com",
			erasedAt: null,
			organizationMemberships: [{ organizationId: 9, role: "OWNER" }],
		});
		prisma.organizationMember.groupBy.mockResolvedValue([
			{ organizationId: 9, role: "OWNER", _count: { _all: 1 } },
			{ organizationId: 9, role: "ADMIN", _count: { _all: 2 } },
			{ organizationId: 9, role: "READER", _count: { _all: 1 } },
		]);

		const subject = await repo.getErasureSubject(42);

		// memberCount is the sum across every role, not the OWNER row count —
		// getting this backwards would make the sole-owner guard unreachable.
		expect(subject?.organizations).toEqual([
			{ organizationId: 9, role: "OWNER", ownerCount: 1, memberCount: 4 },
		]);
	});

	it("does not query the member table for an account with no organizations", async () => {
		const { repo, prisma } = build();
		prisma.user.findUnique.mockResolvedValue({
			id: 42,
			email: "a.person@example.com",
			erasedAt: null,
			organizationMemberships: [],
		});

		const subject = await repo.getErasureSubject(42);

		expect(subject?.organizations).toEqual([]);
		// `{ in: [] }` is a query that can only ever return nothing.
		expect(prisma.organizationMember.groupBy).not.toHaveBeenCalled();
	});
});

describe("ErasureRepository.eraseUser", () => {
	let ctx: ReturnType<typeof build>;

	beforeEach(() => {
		ctx = build();
	});

	it("clears the address out of the unlinked tables BEFORE overwriting it", async () => {
		// This ordering is the whole reason `eraseUser` takes an email at all.
		// OrganizationInvitation has no userId column, and the two description
		// columns are free text — all three are found by the address and become
		// unfindable the moment `User.email` is replaced.
		await ctx.repo.eraseUser(42, "a.person@example.com");

		expect(ctx.trace.indexOf("invitation.deleteMany")).toBeLessThan(ctx.trace.indexOf("$transaction"));
		expect(ctx.prisma.organizationInvitation.deleteMany).toHaveBeenCalledWith({
			where: { email: { equals: "a.person@example.com", mode: "insensitive" } },
		});
	});

	it("writes the derived tombstone values", async () => {
		await ctx.repo.eraseUser(42, "a.person@example.com");

		const [[args]] = ctx.prisma.user.update.mock.calls as unknown as [
			[{ where: { id: number }; data: Record<string, unknown> }],
		];
		expect(args.where).toEqual({ id: 42 });
		expect(args.data.email).toBe("erased-42@erased.invalid");
		expect(args.data.authID).toBe("erased-42");
		expect(args.data.name).toBe("Deleted user");
		expect(args.data.picture).toBeNull();
		expect(args.data.erasedAt).toBeInstanceOf(Date);
	});

	it("deletes every relation and the row in one transaction", async () => {
		await ctx.repo.eraseUser(42, "a.person@example.com");

		// Four deletes plus the update. Splitting them would allow a state where
		// the credentials are gone but the address is not.
		expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(1);
		const ops = ctx.prisma.$transaction.mock.calls[0]?.[0] as unknown[];
		expect(ops).toHaveLength(5);
	});

	it("reports a count per erased model, mapped to the right model", async () => {
		const counts = await ctx.repo.eraseUser(42, "a.person@example.com");

		expect(counts.rowsDeleted).toEqual({
			UserSession: 2,
			UserCredential: 1,
			PromptChat: 3,
			NotificationRead: 5,
		});
		expect(counts.invitationsDeleted).toBe(1);
	});

	it("rewrites a description that holds the address", async () => {
		ctx.prisma.organization.findMany.mockResolvedValue([
			{ id: 3, description: "Personal organization for a.person@example.com" },
		]);

		const counts = await ctx.repo.eraseUser(42, "a.person@example.com");

		expect(ctx.prisma.organization.update).toHaveBeenCalledWith({
			where: { id: 3 },
			data: { description: "Personal organization for erased-42@erased.invalid" },
		});
		expect(counts.organizationDescriptionsRewritten).toBe(1);
	});

	it("writes nothing on a re-run, when the description already reads the way it would be written", async () => {
		// Idempotence. A closure that crashed after the description rewrite must
		// be finishable without a second, pointless UPDATE on every row.
		ctx.prisma.organization.findMany.mockResolvedValue([
			{ id: 3, description: "Personal organization for erased-42@erased.invalid" },
		]);

		const counts = await ctx.repo.eraseUser(42, "erased-42@erased.invalid");

		expect(ctx.prisma.organization.update).not.toHaveBeenCalled();
		expect(counts.organizationDescriptionsRewritten).toBe(0);
	});

	it("skips a null description rather than throwing on it", async () => {
		ctx.prisma.project.findMany.mockResolvedValue([{ id: 4, description: null }]);

		const counts = await ctx.repo.eraseUser(42, "a.person@example.com");

		expect(ctx.prisma.project.update).not.toHaveBeenCalled();
		expect(counts.projectDescriptionsRewritten).toBe(0);
	});
});

describe("ErasureRepository delegate lookup", () => {
	it("throws when the client exposes no delegate for a classified model", async () => {
		// Without the guard this still fails, but as an anonymous TypeError from
		// inside the transaction assembly. The assertion is on the MESSAGE: the
		// failure has to name the model, or nobody can act on it.
		const trace: Trace = [];
		const prisma = makeMockPrisma(trace) as unknown as Record<string, unknown>;
		delete prisma.promptChat;
		const repo = new ErasureRepository(
			prisma as unknown as PrismaClient,
			makeMockSystem() as unknown as SystemRepository,
		);

		await expect(repo.eraseUser(42, "a.person@example.com")).rejects.toThrow(/no delegate for model PromptChat/);
	});
});

describe("ErasureRepository.previewErasure", () => {
	it("counts what the write would delete and writes nothing", async () => {
		const { repo, prisma } = build();

		const counts = await repo.previewErasure(42, "a.person@example.com");

		expect(counts.rowsDeleted).toEqual({
			UserSession: 2,
			UserCredential: 1,
			PromptChat: 3,
			NotificationRead: 5,
		});
		expect(prisma.$transaction).not.toHaveBeenCalled();
		expect(prisma.user.update).not.toHaveBeenCalled();
		expect(prisma.organizationInvitation.deleteMany).not.toHaveBeenCalled();
	});
});
