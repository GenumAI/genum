import { Router } from "express";

import { OtlpController } from "@/controllers/otlp.controller";
import { asyncHandler } from "@/utils/asyncHandler";

/**
 * OTLP trace ingest, mounted at `/api/public/otel/v1/traces`.
 *
 * The path ends in `/v1/traces` because that is what every OTLP exporter appends to its
 * configured endpoint. A collector pointed at `/api/public/otel` finds this without
 * per-vendor configuration, which is the whole point of speaking the protocol.
 *
 * Authenticated by the project API key inside the controller, so this router MUST stay
 * mounted above `app.use(checkJwt)` in `routes.ts`. Below it, a customer's collector gets
 * a 401 for want of a JWT it has no way to obtain, and the failure reads like a bad key.
 */
export function createOtlpRouter(): Router {
	const router = Router();
	const controller = new OtlpController();

	router.post("/v1/traces", asyncHandler(controller.ingestTraces.bind(controller)));

	return router;
}
