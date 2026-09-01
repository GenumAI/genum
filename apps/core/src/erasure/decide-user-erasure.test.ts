import { describe, it, expect } from "vitest";
import {
	decideLabErasure,
	type LabErasureSubject,
	type OrganizationMembershipFacts,
} from "./decide-user-erasure";

function membership(over: Partial<OrganizationMembershipFacts> = {}): OrganizationMembershipFacts {
	return { organizationId: 1, role: "OWNER", ownerCount: 1, memberCount: 1, ...over };
}

function subject(over: Partial<LabErasureSubject> = {}): LabErasureSubject {
	return {
		userId: 42,
		email: "a.person@example.com",
		erasedAt: null,
		systemUserId: 1,
		organizations: [membership()],
		...over,
	};
}

describe("decideLabErasure", () => {
	it("allows an ordinary account", () => {
		expect(decideLabErasure(subject())).toEqual({ erasable: true, alreadyErased: false });
	});

	it("allows the sole OWNER of an organization nobody else is in", () => {
		// The personal organization. Refusing here would make every self-hosted
		// account unclosable, since each one owns exactly this.
		const decision = decideLabErasure(
			subject({ organizations: [membership({ ownerCount: 1, memberCount: 1 })] }),
		);
		expect(decision.erasable).toBe(true);
	});

	it("refuses the sole OWNER of an organization other people are in", () => {
		const decision = decideLabErasure(
			subject({ organizations: [membership({ organizationId: 9, ownerCount: 1, memberCount: 4 })] }),
		);
		expect(decision).toMatchObject({ erasable: false, reason: "sole_owner_of_shared_organization" });
		if (!decision.erasable) {
			expect(decision.detail).toContain("9");
		}
	});

	it("allows an OWNER of a shared organization that has a second owner", () => {
		const decision = decideLabErasure(
			subject({ organizations: [membership({ ownerCount: 2, memberCount: 4 })] }),
		);
		expect(decision.erasable).toBe(true);
	});

	it("allows a non-OWNER of a shared organization with one owner", () => {
		const decision = decideLabErasure(
			subject({ organizations: [membership({ role: "ADMIN", ownerCount: 1, memberCount: 4 })] }),
		);
		expect(decision.erasable).toBe(true);
	});

	it("decides on member counts, not on the `personal` flag", () => {
		// Organization.personal is @default(true) and set once at creation.
		// Nothing keeps it honest when a personal organization is later shared, so
		// the guard must not be reachable through it. This case is a "personal"
		// organization that has since gained members: it must still refuse.
		const decision = decideLabErasure(
			subject({ organizations: [membership({ ownerCount: 1, memberCount: 3 })] }),
		);
		expect(decision).toMatchObject({ erasable: false, reason: "sole_owner_of_shared_organization" });
	});

	it("refuses the configured system user", () => {
		const decision = decideLabErasure(subject({ userId: 1, systemUserId: 1 }));
		expect(decision).toMatchObject({ erasable: false, reason: "system_user" });
	});

	it("refuses the legacy system account, which is identified by its address", () => {
		// SystemService.ensureSystemUserExists still looks "SYSTEM_USER" up on
		// every boot on instances that predate systemConfig.
		const decision = decideLabErasure(subject({ email: "SYSTEM_USER", systemUserId: null }));
		expect(decision).toMatchObject({ erasable: false, reason: "system_user" });
	});

	it("does not mistake an ordinary user for the system user when none is configured", () => {
		expect(decideLabErasure(subject({ systemUserId: null })).erasable).toBe(true);
	});

	it("reports the system user first when an account trips both guards", () => {
		// Refusal order is fixed so the reported reason is stable.
		const decision = decideLabErasure(
			subject({
				userId: 1,
				systemUserId: 1,
				organizations: [membership({ ownerCount: 1, memberCount: 5 })],
			}),
		);
		expect(decision).toMatchObject({ erasable: false, reason: "system_user" });
	});

	it("still allows an already-tombstoned row, and says so", () => {
		// A closure that crashed half way must be re-runnable. Refusing here would
		// strand exactly the accounts that most need finishing.
		expect(decideLabErasure(subject({ erasedAt: new Date("2026-08-31") }))).toEqual({
			erasable: true,
			alreadyErased: true,
		});
		expect(decideLabErasure(subject({ email: "erased-42@erased.invalid" }))).toEqual({
			erasable: true,
			alreadyErased: true,
		});
	});

	it("allows an account with no organizations at all", () => {
		expect(decideLabErasure(subject({ organizations: [] })).erasable).toBe(true);
	});
});
