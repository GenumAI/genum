import { env } from "@/env";
import bcrypt from "bcrypt";

export async function hashPassword(plain: string): Promise<string> {
	return bcrypt.hash(plain, env.AUTH_BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string) {
	return bcrypt.compare(plain, hash);
}
