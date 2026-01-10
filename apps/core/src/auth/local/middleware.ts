// src/auth/middleware.ts
import type { Request, Response, NextFunction } from "express";
import { getSession } from "./session";
import { type GenumMetadata, extractMetadataIds } from "../jwt";

export async function localAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // ✅ Allow internal service-to-service calls in local/dev mode
  if (process.env.DISABLE_LOCAL_AUTH === "true") {
    req.genumMeta = {} as GenumMetadata;
    req.genumMeta.ids = extractMetadataIds(req, 0); // system / internal user
    return next();
  }

  const session = await getSession(req);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userID = session.user.id;

  try {
    req.genumMeta = {} as GenumMetadata;
    req.genumMeta.ids = extractMetadataIds(req, userID);
    next();
  } catch (error: any) {
    return res.status(401).json({ error: error.message });
  }
}
