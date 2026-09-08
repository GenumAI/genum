import type { NextFunction, Request, Response } from "express";

/**
 * Emits one line per completed response: method, path, status, elapsed ms.
 *
 * `requestLog` runs before the handler and can only report what came in, so
 * this is the only place a status code or a duration is recorded. Mount it
 * first, ahead of anything that can end a request early, or the measurement
 * misses the part that was slow.
 */
export function requestTiming(req: Request, res: Response, next: NextFunction): void {
	const startedAt = process.hrtime.bigint();

	res.on("finish", () => {
		const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
		// Query strings are dropped: some routes carry tokens there, and they
		// make otherwise identical requests impossible to group.
		const path = req.originalUrl.split("?")[0];

		console.log(
			`${new Date().toISOString()}: ${req.method} ${path} ${res.statusCode} ${elapsedMs.toFixed(1)}ms`,
		);
	});

	next();
}
