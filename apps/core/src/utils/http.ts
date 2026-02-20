/**
 * Extracts a Bearer token from an Authorization header.
 * Returns null if the header is missing or not in "Bearer <token>" format.
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
	if (!authHeader) return null;

	const parts = authHeader.split(" ");
	if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) return null;

	return parts[1];
}
