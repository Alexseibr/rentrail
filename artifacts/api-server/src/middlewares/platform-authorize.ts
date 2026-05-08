import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError, ForbiddenError } from "../lib/errors";

export interface PlatformContext {
  platformRoles: string[];
  activePlatformRole: string;
}

export function requirePlatformRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const dbRoles = req.platformUser?.platformRoles ?? [];

    if (dbRoles.length === 0) {
      throw new ForbiddenError("Platform access required");
    }

    if (allowedRoles.length > 0) {
      const hasAllowed = allowedRoles.some((role) => dbRoles.includes(role));
      if (!hasAllowed) {
        throw new ForbiddenError("Insufficient platform role");
      }
    }

    const activePlatformRole =
      allowedRoles.find((r) => dbRoles.includes(r)) ?? dbRoles[0];

    req.platformContext = {
      platformRoles: dbRoles,
      activePlatformRole,
    };

    next();
  };
}

export function requireAnyPlatformRole(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  const dbRoles = req.platformUser?.platformRoles ?? [];

  if (dbRoles.length === 0) {
    throw new ForbiddenError("Platform access required");
  }

  req.platformContext = {
    platformRoles: dbRoles,
    activePlatformRole: dbRoles[0],
  };

  next();
}
