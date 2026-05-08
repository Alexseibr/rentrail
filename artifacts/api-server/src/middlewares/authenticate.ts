import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { UnauthorizedError } from "../lib/errors";
import { loadUserPlatformRoles } from "../lib/platform-roles";

export interface PlatformUserContext {
  platformRoles: string[];
}

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid authorization header");
  }

  const token = authHeader.substring(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;

    if (payload.tokenType === "client") {
      req.platformUser = { platformRoles: [] };
      next();
      return;
    }

    loadUserPlatformRoles(payload.userId)
      .then((dbRoles) => {
        req.platformUser = { platformRoles: dbRoles };
        next();
      })
      .catch(next);
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
}
