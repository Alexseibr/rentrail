import type { Request, Response, NextFunction } from "express";
import { resolveApiKey } from "../services/provider-key.service";
import { UnauthorizedError } from "../lib/errors";

export async function authenticateApiKey(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (!apiKey) {
    throw new UnauthorizedError("Missing X-API-Key header");
  }

  const resolved = await resolveApiKey(apiKey);
  if (!resolved) {
    throw new UnauthorizedError("Invalid or revoked API key");
  }

  req.apiKeyContext = resolved;
  next();
}
