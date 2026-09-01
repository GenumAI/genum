import "dotenv/config";
import { db } from "@/database/db";
import { prisma } from "@/database/prisma";
import { env } from "@/env";
import { AccountClosureService } from "@/services/account-closure.service";
import { MailErasureClient } from "@/services/mail-erasure-client";

/**
 * Close one account, from an operator's shell.
 *
 * This is the Phase 1 entry point. `AccountClosureService` decides and drives the
 * closure; without a caller it is unreachable code, and a data-subject request
 * cannot actually be answered. The self-service control is Phase 2.
 *
 *   # preview — writes nothing, anywhere
 *   docker compose exec core pnpm run close-account -- --user=a.person@example.com
 *
 *   # execute — irreversible, and immediate: there is no grace period
 *   docker compose exec core pnpm run close-account -- \
 *     --user=a.person@example.com --confirm=a.person@example.com --apply
 *
 * Preview is the default because both guards are read-only and a refusal
 * discovered after the identity provider is locked is a refusal discovered too
 * late. Run it first and read the reach line: it tells you whether this instance
 * will close every system or only this one.
 */

function arg(name: string): string | undefined {
	const prefix = `--${name}=`;
	const found = process.argv.find((a) => a.startsWith(prefix));
	return found?.slice(prefix.length).trim() || undefined;
}

/** Host and database only — a connection string carries a password. */
function maskedDatabase(): string {
	const raw = process.env.DATABASE_URL;
	if (!raw) throw new Error("DATABASE_URL is not set.");
	try {
		const url = new URL(raw);
		return `${url.host}${url.pathname}`;
	} catch {
		return "(unparseable DATABASE_URL)";
	}
}

/**
 * Branches on "is it all digits", NOT on "does it contain an `@`".
 *
 * The legacy system account's email column holds the literal `SYSTEM_USER`,
 * which is neither. Treating a non-address as an id turns it into `NaN` and
 * reports "no account matches" for a row that plainly exists — and that account
 * is the one the first refusal exists to protect, so the operator must be able
 * to name it and be told why it is refused.
 */
async function resolveUserId(ref: string): Promise<number | null> {
	if (/^\d+$/.test(ref)) {
		const id = Number(ref);
		return Number.isInteger(id) && id > 0 ? id : null;
	}
	const user = await db.users.getUserByEmail(ref);
	return user?.id ?? null;
}

async function main(): Promise<number> {
	const userRef = arg("user");
	const apply = process.argv.includes("--apply");
	const confirm = arg("confirm");

	if (!userRef) {
		console.error(
			"Usage: --user=<id|email> [--confirm=<email> --apply]\n" +
				"Without --apply this previews and writes nothing.",
		);
		return 1;
	}

	console.log(`[close-account] database=${maskedDatabase()}`);
	console.log(
		`[close-account] instance=${env.INSTANCE_TYPE} mode=${apply ? "APPLY" : "preview"}`,
	);

	const userId = await resolveUserId(userRef);
	if (userId === null) {
		console.error(`[close-account] no account matches ${userRef}`);
		return 1;
	}

	const subject = await db.erasure.getErasureSubject(userId);
	if (!subject) {
		console.error(`[close-account] no account with id ${userId}`);
		return 1;
	}

	console.log(`[close-account] subject=${subject.email} id=${subject.userId}`);

	const service = new AccountClosureService(db, new MailErasureClient());

	// Always preview, including on an --apply run. Both guards are read-only, and
	// running them costs one round trip against an irreversible operation.
	const preview = await service.previewClosure(userId);
	console.log(`[close-account] preview: ${JSON.stringify(preview)}`);

	if (preview.status !== "erasable") {
		console.error("[close-account] refused before anything was written.");
		return 1;
	}
	if (preview.labOnly) {
		console.log(
			"[close-account] reach: THIS SYSTEM ONLY — no mail service and no identity " +
				"provider are configured. On a cloud instance that would be a refusal, not a closure.",
		);
	}

	if (!apply) {
		console.log("[close-account] preview only; nothing was written. Re-run with --apply.");
		return 0;
	}

	// The address, not the id. A closure is immediate and irreversible, so a
	// mistyped id must not be able to erase a stranger — the operator has to name
	// the person the preview just printed.
	if (confirm !== subject.email) {
		console.error(
			`[close-account] --confirm must be exactly the address above (${subject.email}). ` +
				"Nothing was written.",
		);
		return 1;
	}

	const outcome = await service.closeAccount(userId);
	console.log(
		JSON.stringify({
			script: "close-account",
			database: maskedDatabase(),
			subjectId: subject.userId,
			finishedAt: new Date().toISOString(),
			outcome,
		}),
	);
	return outcome.status === "closed" ? 0 : 1;
}

main()
	.then(async (code) => {
		await prisma.$disconnect();
		process.exit(code);
	})
	.catch(async (error) => {
		console.error("[close-account] failed:", error);
		await prisma.$disconnect();
		process.exit(1);
	});
