import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError, ForbiddenError } from "../lib/errors";

export interface PlatformContext {
  platformRoles: string[];
  activePlatformRole: string;
}

declare global {
  namespace Express {
    interface Request {
      platformContext?: PlatformContext;
    }
  }
}

export function requirePlatformRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const userPlatformRoles: string[] = req.user.platformRoles ?? [];

    if (userPlatformRoles.length === 0) {
      throw new ForbiddenError("Platform access required");
    }

    if (allowedRoles.length > 0) {
      const hasAllowed = allowedRoles.some((role) => userPlatformRoles.includes(role));
      if (!hasAllowed) {
        throw new ForbiddenError("Insufficient platform role");
      }
    }

    const activePlatformRole =
      allowedRoles.find((r) => userPlatformRoles.includes(r)) ?? userPlatformRoles[0];

    req.platformContext = {
      platformRoles: userPlatformRoles,
      activePlatformRole,
    };

    next();
  };
}
