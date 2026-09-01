import type { Prisma, PrismaClient } from "@/prisma";
import type { SystemRepository } from "./SystemRepository";
import type { LabErasureSubject, OrganizationRoleName } from "@/erasure/decide-user-erasure";
import { ERASED_USER_RELATIONS } from "@/erasure/user-relations";
import {
	TOMBSTONE_NAME,
	redactEmailInText,
	tombstoneAuthIdFor,
	tombstoneEmailFor,
} from "@/erasure/tombstone";

/** One number per thing the closure touched. Every field is evidence. */
export type LabErasureCounts = {
	/** Keyed by model name, one entry per ERASED_USER_RELATIONS entry. */
	rowsDeleted: Record<string, number>;
	invitationsDeleted: number;
	organizationDescriptionsRewritten: number;
	projectDescriptionsRewritten: number;
};

function emptyCounts(): LabErasureCounts {
	const rowsDeleted: Record<string, number> = {};
	for (const relation of ERASED_USER_RELATIONS) {
		rowsDeleted[relation.model] = 0;
	}
	return {
		rowsDeleted,
		invitationsDeleted: 0,
		organizationDescriptionsRewritten: 0,
		projectDescriptionsRewritten: 0,
	};
}

/**
 * The database half of account closure. The decisions live in `src/erasure/`
 * and are pure; everything that needs a connection lives here.
 */
export class ErasureRepository {
	private prisma: PrismaClient;
	private system: SystemRepository;

	constructor(prisma: PrismaClient, system: SystemRepository) {
		this.prisma = prisma;
		this.system = system;
	}

	/**
	 * Everything `decideLabErasure` needs, and nothing it does not. Returns
	 * `null` for an unknown id — a caller must be able to tell "no such user"
	 * from "refused".
	 */
	public async getErasureSubject(userId: number): Promise<LabErasureSubject | null> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				email: true,
				erasedAt: true,
				organizationMemberships: { select: { organizationId: true, role: true } },
			},
		});
		if (!user) {
			return null;
		}

		const organizationIds = user.organizationMemberships.map((m) => m.organizationId);

		// One grouped query rather than two per organization: the guard needs an
		// owner count and a member count for each, and an account can sit in many.
		const grouped =
			organizationIds.length === 0
				? []
				: await this.prisma.organizationMember.groupBy({
						by: ["organizationId", "role"],
						where: { organizationId: { in: organizationIds } },
						_count: { _all: true },
					});

		const memberCounts = new Map<number, number>();
		const ownerCounts = new Map<number, number>();
		for (const row of grouped) {
			const n = row._count._all;
			memberCounts.set(row.organizationId, (memberCounts.get(row.organizationId) ?? 0) + n);
			if (row.role === "OWNER") {
				ownerCounts.set(row.organizationId, (ownerCounts.get(row.organizationId) ?? 0) + n);
			}
		}

		return {
			userId: user.id,
			email: user.email,
			erasedAt: user.erasedAt,
			systemUserId: await this.system.getSystemUserId(),
			organizations: user.organizationMemberships.map((m) => ({
				organizationId: m.organizationId,
				role: m.role as OrganizationRoleName,
				ownerCount: ownerCounts.get(m.organizationId) ?? 0,
				memberCount: memberCounts.get(m.organizationId) ?? 0,
			})),
		};
	}

	/**
	 * What a closure would touch, touching nothing. The preview and the write
	 * count the same rows the same way, so a dry run cannot promise more than
	 * the run delivers.
	 */
	public async previewErasure(userId: number, email: string): Promise<LabErasureCounts> {
		const counts = emptyCounts();

		for (const relation of ERASED_USER_RELATIONS) {
			counts.rowsDeleted[relation.model] = await this.countRelation(
				relation.model,
				relation.userIdField,
				userId,
			);
		}

		counts.invitationsDeleted = await this.prisma.organizationInvitation.count({
			where: { email: { equals: email, mode: "insensitive" } },
		});
		counts.organizationDescriptionsRewritten = (
			await this.findDescriptionsHolding("organization", email)
		).length;
		counts.projectDescriptionsRewritten = (
			await this.findDescriptionsHolding("project", email)
		).length;

		return counts;
	}

	/**
	 * Tombstone the account.
	 *
	 * `email` is the PRE-tombstone address: the invitation rows and the two
	 * description columns are found by it, so they must be dealt with before
	 * `User.email` is overwritten. Passing an already-tombstoned address is safe
	 * and simply matches nothing.
	 *
	 * Idempotent throughout — the replaced values are derived from the id, the
	 * deletes match nothing on a second run, and the description rewrite is
	 * skipped when the text already reads the way it would be written.
	 */
	public async eraseUser(userId: number, email: string): Promise<LabErasureCounts> {
		const counts = emptyCounts();
		const tombstoneEmail = tombstoneEmailFor(userId);

		// Address-keyed work first, while the address is still findable.
		const invitations = await this.prisma.organizationInvitation.deleteMany({
			where: { email: { equals: email, mode: "insensitive" } },
		});
		counts.invitationsDeleted = invitations.count;

		counts.organizationDescriptionsRewritten = await this.rewriteDescriptions(
			"organization",
			email,
			tombstoneEmail,
		);
		counts.projectDescriptionsRewritten = await this.rewriteDescriptions(
			"project",
			email,
			tombstoneEmail,
		);

		// Then the row itself, atomically: an account that lost its credentials
		// but kept its address is a worse state than either end of this write.
		const deletes = ERASED_USER_RELATIONS.map((relation) =>
			this.deleteRelation(relation.model, relation.userIdField, userId),
		);

		const results = await this.prisma.$transaction([
			...deletes,
			this.prisma.user.update({
				where: { id: userId },
				data: {
					email: tombstoneEmail,
					name: TOMBSTONE_NAME,
					authID: tombstoneAuthIdFor(userId),
					picture: null,
					erasedAt: new Date(),
				},
			}),
		]);

		ERASED_USER_RELATIONS.forEach((relation, i) => {
			counts.rowsDeleted[relation.model] = (results[i] as { count: number }).count;
		});

		return counts;
	}

	/**
	 * A Prisma delegate by model name, validated.
	 *
	 * A model in `ERASED_USER_RELATIONS` that the client does not expose fails
	 * either way — but by default it fails as `Cannot read properties of
	 * undefined (reading 'deleteMany')`, thrown while assembling a transaction,
	 * naming neither the model nor the list it came from. This says which model,
	 * which key it looked for, and that the classification is what is wrong.
	 */
	private delegateFor(model: string): {
		count: (args: unknown) => Promise<number>;
		deleteMany: (args: unknown) => Prisma.PrismaPromise<{ count: number }>;
	} {
		const key = model.charAt(0).toLowerCase() + model.slice(1);
		const delegate = (this.prisma as unknown as Record<string, unknown>)[key];
		if (!delegate || typeof delegate !== "object") {
			throw new Error(
				`Prisma client exposes no delegate for model ${model} (looked for \`${key}\`). ` +
					"ERASED_USER_RELATIONS names a model that does not exist, and the " +
					"closure would silently erase nothing.",
			);
		}
		return delegate as ReturnType<ErasureRepository["delegateFor"]>;
	}

	private async countRelation(
		model: string,
		userIdField: string,
		userId: number,
	): Promise<number> {
		return await this.delegateFor(model).count({ where: { [userIdField]: userId } });
	}

	/** Returns the unawaited Prisma promise, so the caller can batch it. */
	private deleteRelation(model: string, userIdField: string, userId: number) {
		return this.delegateFor(model).deleteMany({ where: { [userIdField]: userId } });
	}

	private async findDescriptionsHolding(
		model: "organization" | "project",
		email: string,
	): Promise<Array<{ id: number; description: string | null }>> {
		const rows = await (model === "organization"
			? this.prisma.organization.findMany({
					where: { description: { contains: email, mode: "insensitive" } },
					select: { id: true, description: true },
				})
			: this.prisma.project.findMany({
					where: { description: { contains: email, mode: "insensitive" } },
					select: { id: true, description: true },
				}));
		return rows;
	}

	private async rewriteDescriptions(
		model: "organization" | "project",
		email: string,
		replacement: string,
	): Promise<number> {
		const rows = await this.findDescriptionsHolding(model, email);
		let rewritten = 0;
		for (const row of rows) {
			if (row.description === null) {
				continue;
			}
			const next = redactEmailInText(row.description, email, replacement);
			// Identity means the text already reads the way we would write it —
			// on a re-run, every row lands here and no write happens.
			if (next === row.description) {
				continue;
			}
			if (model === "organization") {
				await this.prisma.organization.update({
					where: { id: row.id },
					data: { description: next },
				});
			} else {
				await this.prisma.project.update({
					where: { id: row.id },
					data: { description: next },
				});
			}
			rewritten++;
		}
		return rewritten;
	}
}
