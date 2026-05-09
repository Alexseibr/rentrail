import type { AccessTokenPayload } from "./lib/jwt";
import type { PlatformUserContext } from "./middlewares/authenticate";
import type { TenantContext } from "./middlewares/authorize";
import type { PlatformContext } from "./middlewares/platform-authorize";

declare module "express-serve-static-core" {
  interface Request {
    body: unknown;
  }
}

declare module "superagent" {
  interface Response {
    body: unknown;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
      platformUser?: PlatformUserContext;
      tenant?: TenantContext;
      apiKeyContext?: { companyId: string; provider: string; keyId: string };
      correlationId?: string;
      platformContext?: PlatformContext;
      rawBody?: Buffer;
    }
  }
}
