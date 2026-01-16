import type { Request, Response } from "express";
import { db } from "@/database/db";

const SESSION_COOKIE_NAME = "sid";

export async function createSession(res: Response, userId: number) {
	const session = await db.users.createLocalUserSession(userId);

	res.cookie(SESSION_COOKIE_NAME, session.id, {
		httpOnly: true,
		sameSite: "none",
		secure: true,
		expires: session.expiresAt,
	});
}

export async function getSession(req: Request) {
	const sid = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
	if (!sid) {
		return null;
	}

	const session = await db.users.getLocalUserSessionById(sid);

	if (!session) return null;
	if (session.revokedAt) return null;
	if (session.expiresAt < new Date()) return null;

	return session;
}

export async function destroySession(req: Request, res: Response) {
	const sid = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
	if (sid) {
		await db.users.deleteLocalUserSession(sid);
	}

	res.clearCookie(SESSION_COOKIE_NAME, {
		httpOnly: true,
		sameSite: "none", // Must match createSession settings
		secure: true, // Must match createSession settings
	});
}
