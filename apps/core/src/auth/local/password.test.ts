import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password utility", () => {
	const password = "my-secret-password";

	it("should hash password correctly", async () => {
		const hash = await hashPassword(password);

		expect(hash).toBeDefined();
		expect(hash).not.toBe(password);
		expect(hash.length).toBeGreaterThan(20);
	});

	it("should verify correct password", async () => {
		const hash = await hashPassword(password);
		const isValid = await verifyPassword(password, hash);

		expect(isValid).toBe(true);
	});

	it("should not verify incorrect password", async () => {
		const hash = await hashPassword(password);
		const isValid = await verifyPassword("wrong-password", hash);

		expect(isValid).toBe(false);
	});

	it("should generate different hashes for same password (salting)", async () => {
		const hash1 = await hashPassword(password);
		const hash2 = await hashPassword(password);

		expect(hash1).not.toBe(hash2);
	});
});
