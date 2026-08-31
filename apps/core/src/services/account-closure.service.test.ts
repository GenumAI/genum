import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEnv = vi.hoisted(() => ({
	INSTANCE_TYPE: "cloud" as "cloud" | "local",
	NODE_ENV: "test",
}));
vi.mock("@/env", () => ({ env: mockEnv }));

// The notice goes out on the same webhook the org invite uses. Without this mock
// `send()` reads an unset WEBHOOK_URL, returns early, and every assertion about
// notifying passes while nothing is ever sent.
const mockWebhooks = vi.hoisted(() => ({ accountClosureNotice: vi.fn() }));
vi.mock("./webhooks/webhooks", () => ({ webhooks: mockWebhooks }));

import { AccountClosureService } from "./account-closure.service";
import type { Database } from "@/database/db";
import type {
	Auth0IdentityRef,
	MailErasability,
	MailErasureClient,
	MailResult,
} from "./mail-erasure-client";
import type { LabErasureCounts } from "@/database/repositories/ErasureRepository";
import type { LabErasureSubject } from "@/erasure/decide-user-erasure";

/** Records the order calls arrive in. Most of this file is an ordering proof. */
type Trace = string[];

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

function makeMockDb(trace: Trace) {
	return {
		erasure: {
			getErasureSubject: vi.fn(async (): Promise<LabErasureSubject | null> => subject()),
			eraseUser: vi.fn(async (): Promise<LabErasureCounts> => {
				trace.push("lab.eraseUser");
				return {
					rowsDeleted: {},
					invitationsDeleted: 0,
					organizationDescriptionsRewritten: 0,
					projectDescriptionsRewritten: 0,
				};
			}),
		},
	};
}

const IDENTITIES: Auth0IdentityRef[] = [
	{ userId: "auth0|aaa", email: "a.person@example.com" },
	{ userId: "google-oauth2|bbb", email: "a.person@example.com" },
];

// Every mock is annotated with the client's own result types. Without that the
// literal `true` in `ok: true` widens to `boolean` and each later
// `mockResolvedValue` fails to typecheck against the union.
function makeMockMail(trace: Trace) {
	return {
		isConfigured: vi.fn((): boolean => true),
		erasability: vi.fn(async (): Promise<MailResult<MailErasability>> => {
			trace.push("mail.erasability");
			return { ok: true, value: { erasable: true, notFound: false, reason: null, detail: null } };
		}),
		lockout: vi.fn(async (): Promise<MailResult<{ identities: Auth0IdentityRef[] }>> => {
			trace.push("mail.lockout");
			return { ok: true, value: { identities: IDENTITIES } };
		}),
		erase: vi.fn(async (): Promise<MailResult<{ notFound: boolean }>> => {
			trace.push("mail.erase");
			return { ok: true, value: { notFound: false } };
		}),
		auth0Delete: vi.fn(
			async (): Promise<MailResult<{ deleted: string[]; alreadyGone: string[] }>> => {
				trace.push("mail.auth0Delete");
				return { ok: true, value: { deleted: ["auth0|aaa", "google-oauth2|bbb"], alreadyGone: [] } };
			},
		),
	};
}

function build() {
	const trace: Trace = [];
	const db = makeMockDb(trace);
	const mail = makeMockMail(trace);
	const service = new AccountClosureService(
		db as unknown as Database,
		mail as unknown as MailErasureClient,
	);
	return { service, db, mail, trace };
}

const UNREACHABLE = { ok: false as const, kind: "unreachable" as const, detail: "ECONNREFUSED" };

describe("AccountClosureService.closeAccount", () => {
	beforeEach(() => {
		mockEnv.INSTANCE_TYPE = "cloud";
		mockWebhooks.accountClosureNotice.mockReset();
		mockWebhooks.accountClosureNotice.mockResolvedValue(true);
	});

	it("reports not_found for an unknown user and touches nothing", async () => {
		const { service, db, mail } = build();
		db.erasure.getErasureSubject.mockResolvedValue(null);

		expect(await service.closeAccount(1)).toEqual({ status: "not_found" });
		expect(mail.erasability).not.toHaveBeenCalled();
		expect(db.erasure.eraseUser).not.toHaveBeenCalled();
	});

	it("refuses on our own guard without reaching the other systems at all", async () => {
		const { service, db, mail } = build();
		db.erasure.getErasureSubject.mockResolvedValue(
			subject({ organizations: [{ organizationId: 9, role: "OWNER", ownerCount: 1, memberCount: 4 }] }),
		);

		const outcome = await service.closeAccount(42);

		expect(outcome).toMatchObject({
			status: "refused",
			step: "lab_guard",
			reason: "sole_owner_of_shared_organization",
		});
		expect(mail.erasability).not.toHaveBeenCalled();
		expect(mail.lockout).not.toHaveBeenCalled();
	});

	it("does not lock anyone out when the other side refuses", async () => {
		// The whole reason both guards run before step 3. Without it we block a
		// person's identities and only then learn the closure cannot proceed —
		// locked out, erased nowhere.
		const { service, mail, db } = build();
		mail.erasability.mockResolvedValue({
			ok: true,
			value: { erasable: false, notFound: false, reason: "is_bot", detail: "This is a service account." },
		});

		const outcome = await service.closeAccount(42);

		expect(outcome).toMatchObject({ status: "refused", step: "mail_guard", reason: "is_bot" });
		expect(mail.lockout).not.toHaveBeenCalled();
		expect(db.erasure.eraseUser).not.toHaveBeenCalled();
	});

	it("stops before erasing anything when the lockout fails", async () => {
		const { service, mail, db } = build();
		mail.lockout.mockResolvedValue(UNREACHABLE);

		const outcome = await service.closeAccount(42);

		expect(outcome).toMatchObject({ status: "failed", step: "auth0_lockout" });
		expect(mail.erase).not.toHaveBeenCalled();
		expect(db.erasure.eraseUser).not.toHaveBeenCalled();
	});

	it("does not tombstone our row when their erase fails", async () => {
		// Order proof. Our tombstone is the point of no return for finding the
		// person by address, so it must not land while a prior step is unresolved.
		const { service, mail, db } = build();
		mail.erase.mockResolvedValue(UNREACHABLE);

		const outcome = await service.closeAccount(42);

		expect(outcome).toMatchObject({ status: "failed", step: "mail_erase" });
		expect(db.erasure.eraseUser).not.toHaveBeenCalled();
		expect(mail.auth0Delete).not.toHaveBeenCalled();
	});

	it("does not delete identities when our own tombstone fails", async () => {
		// Identity deletion is the only irreversible step; nothing may outrun it.
		const { service, db, mail } = build();
		db.erasure.eraseUser.mockRejectedValue(new Error("deadlock detected"));

		const outcome = await service.closeAccount(42);

		expect(outcome).toMatchObject({ status: "failed", step: "lab_erase", detail: "deadlock detected" });
		expect(mail.auth0Delete).not.toHaveBeenCalled();
	});

	it("runs every step in the designed order on the happy path", async () => {
		const { service, trace } = build();

		const outcome = await service.closeAccount(42);

		expect(trace).toEqual([
			"mail.erasability",
			"mail.lockout",
			"mail.erase",
			"lab.eraseUser",
			"mail.auth0Delete",
		]);
		expect(outcome).toMatchObject({
			status: "closed",
			completed: ["lab_guard", "mail_guard", "auth0_lockout", "mail_erase", "lab_erase", "auth0_delete"],
			identitiesDeleted: 2,
			labOnly: false,
		});
	});

	it("deletes exactly the identities the lockout enumerated", async () => {
		// Not a re-enumeration: re-reading the address at the last step would also
		// find a NEW, legitimate account opened with it after the closure began.
		const { service, mail } = build();

		await service.closeAccount(42);

		expect(mail.auth0Delete).toHaveBeenCalledWith(["auth0|aaa", "google-oauth2|bbb"]);
	});

	it("erases with the pre-tombstone address", async () => {
		// Our own write overwrites the address, and the other systems find the
		// person by it. Reading it late would search for a tombstone.
		const { service, db, mail } = build();

		await service.closeAccount(42);

		expect(db.erasure.eraseUser).toHaveBeenCalledWith(42, "a.person@example.com");
		expect(mail.lockout).toHaveBeenCalledWith("a.person@example.com");
	});

	it("proceeds when the other side holds no such account", async () => {
		// A person can have an account here and never have used the mail product.
		// That is a 200, not an error, and must not stop the closure.
		const { service, mail, db } = build();
		mail.erasability.mockResolvedValue({
			ok: true,
			value: { erasable: false, notFound: true, reason: null, detail: null },
		});

		const outcome = await service.closeAccount(42);

		expect(outcome).toMatchObject({ status: "closed" });
		expect(db.erasure.eraseUser).toHaveBeenCalled();
	});

	it("re-runs an already-tombstoned account and says so", async () => {
		const { service, db } = build();
		db.erasure.getErasureSubject.mockResolvedValue(subject({ erasedAt: new Date("2026-08-31") }));

		expect(await service.closeAccount(42)).toMatchObject({ status: "closed", alreadyErased: true });
	});
});

describe("AccountClosureService without the other systems configured", () => {
	it("closes locally on a self-hosted instance", async () => {
		// There is no identity provider and no mail service here. Refusing would
		// make every self-hosted account permanently unclosable.
		mockEnv.INSTANCE_TYPE = "local";
		const { service, db, mail } = build();
		mail.isConfigured.mockReturnValue(false);

		const outcome = await service.closeAccount(42);

		expect(outcome).toMatchObject({ status: "closed", labOnly: true, identitiesDeleted: 0 });
		expect(db.erasure.eraseUser).toHaveBeenCalledWith(42, "a.person@example.com");
		expect(mail.erasability).not.toHaveBeenCalled();
	});

	it("refuses on a cloud instance rather than leaving the identity alive", async () => {
		// The dangerous direction. A cloud account always exists at the identity
		// provider, so erasing only this side and reporting success would tell the
		// person their account is closed while they can still log in.
		mockEnv.INSTANCE_TYPE = "cloud";
		const { service, db, mail } = build();
		mail.isConfigured.mockReturnValue(false);

		const outcome = await service.closeAccount(42);

		expect(outcome).toMatchObject({
			status: "refused",
			step: "mail_guard",
			reason: "cross_system_closure_not_configured",
		});
		expect(db.erasure.eraseUser).not.toHaveBeenCalled();
	});
});

describe("AccountClosureService.previewClosure", () => {
	beforeEach(() => {
		mockEnv.INSTANCE_TYPE = "cloud";
	});

	it("writes nothing anywhere", async () => {
		const { service, db, mail } = build();

		const preview = await service.previewClosure(42);

		expect(preview).toMatchObject({ status: "erasable", alreadyErased: false, labOnly: false });
		expect(db.erasure.eraseUser).not.toHaveBeenCalled();
		expect(mail.lockout).not.toHaveBeenCalled();
		expect(mail.erase).not.toHaveBeenCalled();
		expect(mail.auth0Delete).not.toHaveBeenCalled();
	});

	it("surfaces our guard's refusal", async () => {
		const { service, db } = build();
		db.erasure.getErasureSubject.mockResolvedValue(subject({ userId: 1, systemUserId: 1 }));

		expect(await service.previewClosure(1)).toMatchObject({
			status: "refused",
			step: "lab_guard",
			reason: "system_user",
		});
	});

	it("surfaces their guard's refusal", async () => {
		const { service, mail } = build();
		mail.erasability.mockResolvedValue({
			ok: true,
			value: { erasable: false, notFound: false, reason: "sole_workspace_owner", detail: "Transfer first." },
		});

		expect(await service.previewClosure(42)).toMatchObject({
			status: "refused",
			step: "mail_guard",
			reason: "sole_workspace_owner",
		});
	});
});

describe("the closure notice", () => {
	beforeEach(() => {
		mockEnv.INSTANCE_TYPE = "cloud";
		mockWebhooks.accountClosureNotice.mockReset();
		mockWebhooks.accountClosureNotice.mockResolvedValue(true);
	});

	// It goes out on the same webhook the org invite uses, and it must go out
	// while the address is still the person's own: the tombstone overwrites
	// `User.email`, so after that there is nobody left to write to.
	it("is sent to the real address before anything is written", async () => {
		const { service, mail } = build();

		const outcome = await service.closeAccount(42);

		expect(mockWebhooks.accountClosureNotice).toHaveBeenCalledWith({
			to: "a.person@example.com",
			stage: "test",
		});
		// Before the FIRST write, which is the Auth0 lockout.
		expect(mockWebhooks.accountClosureNotice.mock.invocationCallOrder[0]).toBeLessThan(
			mail.lockout.mock.invocationCallOrder[0] as number,
		);
		expect(outcome).toMatchObject({ status: "closed", notified: true });
	});

	// Best-effort by design: a closure that aborted because a notification failed
	// could strand a half-closed account, which is what every ordering decision
	// here exists to avoid. So the failure is reported, never thrown.
	it("does not abort the closure when it fails, and says so", async () => {
		const { service, trace } = build();
		mockWebhooks.accountClosureNotice.mockResolvedValue(false);

		const outcome = await service.closeAccount(42);

		expect(outcome).toMatchObject({ status: "closed", notified: false });
		expect(trace).toEqual([
			"mail.erasability",
			"mail.lockout",
			"mail.erase",
			"lab.eraseUser",
			"mail.auth0Delete",
		]);
	});

	it("is not sent when our own guard refuses", async () => {
		const { service, db } = build();
		db.erasure.getErasureSubject.mockResolvedValue(subject({ systemUserId: 42 }));

		await service.closeAccount(42);

		expect(mockWebhooks.accountClosureNotice).not.toHaveBeenCalled();
	});

	// The guard order is the point: both sides refuse before anything happens, and
	// telling someone their account is closing and then not closing it is its own
	// kind of wrong.
	it("is not sent when the other side refuses", async () => {
		const { service, mail } = build();
		mail.erasability.mockResolvedValue({
			ok: true,
			value: { erasable: false, notFound: false, reason: "sole_workspace_owner", detail: "x" },
		});

		await service.closeAccount(42);

		expect(mockWebhooks.accountClosureNotice).not.toHaveBeenCalled();
	});

	// Attempted, not necessarily delivered: a self-hosted instance usually has no
	// webhook consumer, and `accountClosureNotice` reports false there rather than
	// claiming a notice nobody received. The orchestrator propagates either way.
	it("attempts the notice on a self-hosted closure too, and reports what came back", async () => {
		const { service, mail } = build();
		mockEnv.INSTANCE_TYPE = "local";
		mail.isConfigured.mockReturnValue(false);
		mockWebhooks.accountClosureNotice.mockResolvedValue(false);

		const outcome = await service.closeAccount(42);

		expect(mockWebhooks.accountClosureNotice).toHaveBeenCalledTimes(1);
		expect(outcome).toMatchObject({ status: "closed", labOnly: true, notified: false });
	});
});
