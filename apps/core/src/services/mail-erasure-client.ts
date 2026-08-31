import axios, { type AxiosInstance } from "axios";
import { env } from "@/env";

/**
 * The mail service leg of a cross-system account closure.
 *
 * Genum decides and drives the closure; the mail service performs its own
 * erasure AND makes the identity-provider calls on our behalf. The second part
 * is not a transfer of authority — it is that the Management API client already
 * exists on exactly one side. This service holds no client secret for the
 * identity provider at all, and giving it one to save a hop would put a second
 * copy of that secret in a second service.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * EVERYTHING IN THE `wire shapes` BLOCK BELOW IS A CONTRACT WITH A SEPARATE
 * SERVICE. Reconciled against its request parser and route handlers; keep them
 * gathered here so the next reconciliation is a single-file edit.
 * ────────────────────────────────────────────────────────────────────────────
 */

// ── wire shapes ─────────────────────────────────────────────────────────────

/**
 * How we name a person to the mail service: `{ user: "<id or email>" }`.
 *
 * We always send the ADDRESS, never our own user id. Its parser branches on
 * whether the value contains an `@` and otherwise looks the value up as ITS OWN
 * primary key — which is not our id and never will be. Sending our id would not
 * match the wrong account, it would match nothing, and the closure would read
 * that as "the mail service holds no such person" and silently skip a leg that
 * had real data to erase.
 */
function userRefBody(email: string): Record<string, unknown> {
	return { user: email };
}

/**
 * Its endpoints report "no such account" as `{ found: false }` with a 200, not as
 * an error status. A person can hold a Genum account and never have used mail.
 */
function readNotFound(data: Record<string, unknown>): boolean {
	return data.found === false;
}

/** Its erase endpoint requires an explicit confirmation token, like ours does. */
const CONFIRM_TOKEN = "erase";

const PATHS = {
	erasability: "/api/service/lab/erasability",
	lockout: "/api/service/lab/lockout",
	erase: "/api/service/lab/erase",
	auth0Delete: "/api/service/lab/auth0-delete",
} as const;

// ── results ─────────────────────────────────────────────────────────────────

/** One identity at the identity provider. `userId` is the `sub`. */
export type Auth0IdentityRef = { userId: string; email: string };

export type MailCallFailure =
	/** No URL or no key configured here. The closure must not proceed. */
	| { ok: false; kind: "not_configured"; detail: string }
	/**
	 * The mail service answered 404. Its endpoints answer 404 rather than 401
	 * when its own inbound key is unset, so a deployment that never opted in
	 * does not advertise that an erasure endpoint exists. Distinct from
	 * "no such user", which is a 200.
	 */
	| { ok: false; kind: "service_disabled"; detail: string }
	/** It refused on its own guard (409). Carries its reason verbatim. */
	| { ok: false; kind: "refused"; reason: string; detail: string }
	/** Anything else: network, timeout, 5xx, unparseable body. */
	| { ok: false; kind: "unreachable"; detail: string };

export type MailResult<T> = { ok: true; value: T } | MailCallFailure;

export type MailErasability = {
	erasable: boolean;
	/** True when it holds no such account. Not an error: a person can have a
	 *  Genum account and have never used mail. */
	notFound: boolean;
	reason: string | null;
	detail: string | null;
};

/**
 * Timeouts are explicit and generous, because `lockout` makes one round trip to
 * the identity provider per identity found. A closure that hangs mid-flight is
 * the worst state available: identities blocked, nothing erased, and no answer
 * about where it stopped.
 */
const TIMEOUT_MS = {
	read: 15_000,
	write: 45_000,
} as const;

export class MailErasureClient {
	private http: AxiosInstance | null;

	constructor() {
		this.http =
			env.MAIL_SERVICE_URL && env.MAIL_ERASURE_APIKEY
				? axios.create({
						baseURL: env.MAIL_SERVICE_URL,
						headers: {
							// Case-sensitive "Bearer", exactly two parts — the other side
							// splits on whitespace and compares the scheme literally.
							Authorization: `Bearer ${env.MAIL_ERASURE_APIKEY}`,
							"Content-Type": "application/json",
						},
						// Read every status ourselves; a 409 is an answer, not a crash.
						validateStatus: () => true,
					})
				: null;
	}

	public isConfigured(): boolean {
		return this.http !== null;
	}

	/** Whether the mail service would erase this account. Writes nothing. */
	public async erasability(email: string): Promise<MailResult<MailErasability>> {
		return await this.post(PATHS.erasability, userRefBody(email), TIMEOUT_MS.read, (data) => ({
			erasable: data.erasable === true,
			notFound: readNotFound(data),
			reason: typeof data.reason === "string" ? data.reason : null,
			detail: typeof data.detail === "string" ? data.detail : null,
		}));
	}

	/**
	 * Steps 0 and 1: enumerate every identity for this address, then block each
	 * one and revoke its sessions.
	 *
	 * Enumeration is by ADDRESS, not by the one subject we happen to know. The
	 * tenant's account-linking action links same-address identities only when the
	 * address is verified, so an unverified duplicate is never linked and never
	 * appears as an identity of the primary user. Closing only the subject we
	 * know would leave that account able to log in and rebuild everything.
	 */
	public async lockout(email: string): Promise<MailResult<{ identities: Auth0IdentityRef[] }>> {
		return await this.post(PATHS.lockout, { email }, TIMEOUT_MS.write, (data) => ({
			identities: Array.isArray(data.identities)
				? data.identities
						.map((raw: unknown) => {
							const row = raw as Record<string, unknown>;
							return typeof row?.userId === "string"
								? {
										userId: row.userId,
										email: typeof row.email === "string" ? row.email : "",
									}
								: null;
						})
						.filter((i: Auth0IdentityRef | null): i is Auth0IdentityRef => i !== null)
				: [],
		}));
	}

	/** Step 2: the mail service tombstones its own copy of the account. */
	public async erase(email: string): Promise<MailResult<{ notFound: boolean }>> {
		return await this.post(
			PATHS.erase,
			{ ...userRefBody(email), confirm: CONFIRM_TOKEN },
			TIMEOUT_MS.write,
			(data) => ({ notFound: readNotFound(data) }),
		);
	}

	/**
	 * Step 4: delete the identities enumerated in step 0.
	 *
	 * The list is passed in rather than re-enumerated, so this acts on exactly
	 * the set that was blocked. Re-enumerating here would also catch a NEW,
	 * legitimate account opened with that address after the closure began, and
	 * delete it.
	 */
	public async auth0Delete(
		identities: readonly string[],
	): Promise<MailResult<{ deleted: string[]; alreadyGone: string[] }>> {
		if (identities.length === 0) {
			// Nothing to do is a success, not a call. Keeps a resumed closure from
			// failing on an empty list.
			return { ok: true, value: { deleted: [], alreadyGone: [] } };
		}
		return await this.post(
			PATHS.auth0Delete,
			{ identities: [...identities], confirm: CONFIRM_TOKEN },
			TIMEOUT_MS.write,
			(data) => ({
				deleted: asStringArray(data.deleted),
				alreadyGone: asStringArray(data.alreadyGone),
			}),
		);
	}

	private async post<T>(
		path: string,
		body: Record<string, unknown>,
		timeout: number,
		read: (data: Record<string, unknown>) => T,
	): Promise<MailResult<T>> {
		if (!this.http) {
			return {
				ok: false,
				kind: "not_configured",
				detail: "MAIL_SERVICE_URL and MAIL_ERASURE_APIKEY must both be set to close an account across systems.",
			};
		}

		let status: number;
		let data: Record<string, unknown>;
		try {
			const response = await this.http.post(path, body, { timeout });
			status = response.status;
			data = (response.data ?? {}) as Record<string, unknown>;
		} catch (error) {
			// Never include the request config: it carries the Authorization header.
			return { ok: false, kind: "unreachable", detail: describeError(error) };
		}

		if (status === 404) {
			return {
				ok: false,
				kind: "service_disabled",
				detail: `${path} answered 404 — the mail service's inbound erasure key is not configured.`,
			};
		}
		if (status === 409) {
			return {
				ok: false,
				kind: "refused",
				reason: typeof data.reason === "string" ? data.reason : "refused",
				detail:
					typeof data.detail === "string"
						? data.detail
						: "The mail service refused this closure.",
			};
		}
		if (status < 200 || status >= 300) {
			return { ok: false, kind: "unreachable", detail: `${path} answered ${status}.` };
		}

		try {
			return { ok: true, value: read(data) };
		} catch (error) {
			return {
				ok: false,
				kind: "unreachable",
				detail: `${path} returned a body we could not read: ${describeError(error)}`,
			};
		}
	}
}

function asStringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** A message safe to log: no headers, no request body, no key. */
function describeError(error: unknown): string {
	if (axios.isAxiosError(error)) {
		return error.code ? `${error.code}: ${error.message}` : error.message;
	}
	return error instanceof Error ? error.message : String(error);
}
