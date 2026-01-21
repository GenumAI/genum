import type { Request } from "express";

export function requestLog(req: Request): void {
	const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
	const originalUrl = req.originalUrl;
	const bodyLog = req.body === undefined ? "" : ` ${JSON.stringify(req.body)}`;

	console.log(`${new Date().toISOString()}: [${ip}] ${req.method} ${originalUrl}${bodyLog}`);
}
