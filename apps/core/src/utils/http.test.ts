import { describe, it, expect } from "vitest";
import { extractBearerToken } from "./http";

describe("extractBearerToken", () => {
	it("returns the token from a valid Bearer header", () => {
		expect(extractBearerToken("Bearer abc123")).toBe("abc123");
	});

	it("returns null when header is undefined", () => {
		expect(extractBearerToken(undefined)).toBeNull();
	});

	it("returns null when header is an empty string", () => {
		expect(extractBearerToken("")).toBeNull();
	});

	it("returns null when scheme is not Bearer", () => {
		expect(extractBearerToken("Basic abc123")).toBeNull();
		expect(extractBearerToken("Token abc123")).toBeNull();
	});

	it("returns null when Bearer is lowercase", () => {
		expect(extractBearerToken("bearer abc123")).toBeNull();
	});

	it("returns null when token part is missing", () => {
		expect(extractBearerToken("Bearer")).toBeNull();
		expect(extractBearerToken("Bearer ")).toBeNull();
	});

	it("returns null when there are extra parts", () => {
		expect(extractBearerToken("Bearer token extra")).toBeNull();
	});

	it("handles tokens with special characters", () => {
		expect(extractBearerToken("Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig")).toBe(
			"eyJhbGciOiJIUzI1NiJ9.payload.sig",
		);
	});
});
