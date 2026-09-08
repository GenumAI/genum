import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/api/client";
import { accountClosureApi } from "@/api/user";
import type { ClosureOutcome, ClosurePreview, ClosureRefusal } from "@/api/user";
import { closureKeys } from "@/query-keys/closure.keys";
import { useAuth } from "@/hooks/useAuth";
import { isLocalAuth } from "@/lib/auth";

/**
 * Closing your own account.
 *
 * Two re-authentication paths, chosen by auth mode and never combined -- the
 * server dispatches exclusively, so offering both here would only produce
 * requests it refuses:
 *
 *   cloud → the server answers 401 `step_up_required`, and we start a
 *           `max_age: 0` redirect so the identity provider re-authenticates the
 *           person and the next token carries a fresh `auth_time`.
 *   local → a password field in the dialog; there is no identity provider to
 *           redirect to.
 *
 * Every failure below is read off `ApiError`, because that is what the axios
 * response interceptor rejects with -- a plain `Error` subclass that carries the
 * status and the parsed body but is NOT an axios error. Asking `isAxiosError`
 * here answers false for every response the server ever sends, which would bury
 * the refusal and the step-up under a generic "did not reach the server".
 */

export type ClosureError =
	/** The service refused. `detail` is written to be shown verbatim. */
	| { kind: "refused"; refusal: ClosureRefusal }
	/** Self-hosted only: no password given, or the wrong one. */
	| { kind: "password"; detail: string }
	/** A step failed part way through. Retrying is the intended recovery. */
	| { kind: "failed"; detail: string };

export function useAccountClosure(isOpen: boolean) {
	const { loginWithRedirect } = useAuth();
	const needsPassword = isLocalAuth();

	const [isClosing, setIsClosing] = useState(false);
	const [error, setError] = useState<ClosureError | null>(null);

	// Writes nothing on the server, so it is safe to run the moment the dialog
	// opens -- which it must, because the list of consequences has to be on
	// screen before anyone is asked to confirm.
	const preview = useQuery<ClosurePreview>({
		queryKey: closureKeys.preview(),
		queryFn: async () => {
			try {
				return await accountClosureApi.preview();
			} catch (caught) {
				// The server answers a refusal with 409, so it arrives here as a
				// rejection -- but it is an answer, not a failure. Resolving it as
				// data is what puts the service's own wording on screen in place
				// of the confirmation; rethrowing would show "we could not check".
				const refusal = asRefusal(caught);
				if (refusal) {
					return refusal;
				}
				throw caught;
			}
		},
		enabled: isOpen,
		staleTime: 0,
		retry: false,
	});

	const close = useCallback(
		async (password?: string): Promise<ClosureOutcome | null> => {
			setIsClosing(true);
			setError(null);
			try {
				const outcome = await accountClosureApi.close(password);
				if (outcome.status === "refused") {
					setError({ kind: "refused", refusal: outcome });
					return outcome;
				}
				return outcome;
			} catch (caught) {
				setError(await handle(caught, needsPassword, loginWithRedirect));
				return null;
			} finally {
				setIsClosing(false);
			}
		},
		[needsPassword, loginWithRedirect],
	);

	return {
		preview: preview.data ?? null,
		isLoadingPreview: preview.isLoading,
		previewFailed: preview.isError,
		needsPassword,
		isClosing,
		error,
		clearError: () => setError(null),
		close,
	};
}

type LoginWithRedirect = ReturnType<typeof useAuth>["loginWithRedirect"];

/**
 * The 409 body, if this is one. The interceptor leaves `status` undefined only
 * when the request never got a response, so a status of 409 is always a real
 * answer from `statusFor()`.
 */
function asRefusal(caught: unknown): ClosureRefusal | null {
	if (!(caught instanceof ApiError) || caught.status !== 409) {
		return null;
	}

	const data = (caught.data ?? {}) as Partial<ClosureRefusal>;
	if (!data.reason) {
		return null;
	}

	return {
		status: "refused",
		step: data.step ?? "",
		reason: data.reason,
		detail: data.detail ?? "This account cannot be closed yet.",
	};
}

async function handle(
	caught: unknown,
	needsPassword: boolean,
	loginWithRedirect: LoginWithRedirect,
): Promise<ClosureError> {
	// No status means the interceptor's network branch: the request never
	// reached the server, so there is no body to read.
	if (!(caught instanceof ApiError) || caught.status === undefined) {
		return { kind: "failed", detail: "The request did not reach the server. Try again." };
	}

	const refusal = asRefusal(caught);
	if (refusal) {
		return { kind: "refused", refusal };
	}

	const data = (caught.data ?? {}) as { detail?: string };

	if (caught.status === 401) {
		if (needsPassword) {
			// One message for both "wrong password" and "no credential", matching
			// the server: this endpoint must not become an oracle.
			return {
				kind: "password",
				detail: data.detail ?? "Enter your current password to confirm this action.",
			};
		}

		// Cloud: prove the person is present by sending them through the identity
		// provider again. max_age=0 forces a real re-authentication rather than a
		// silent SSO hop, which is what makes the resulting auth_time meaningful.
		await loginWithRedirect({
			authorizationParams: { max_age: 0 },
			appState: { returnTo: `${window.location.pathname}${window.location.search}` },
		} as Parameters<LoginWithRedirect>[0]);
		return { kind: "failed", detail: "Confirming your identity…" };
	}

	return {
		kind: "failed",
		detail: data.detail ?? "The closure did not complete. Nothing was lost; try again.",
	};
}
