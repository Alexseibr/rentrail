import jwt from "jsonwebtoken";
import { config } from "./config";

export interface AccessTokenPayload {
  userId: string;
  email?: string;
  isSuperAdmin: boolean;
  platformRoles: string[];
  clientId?: string;
  companyId?: string;
  tokenType?: "staff" | "client";
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
  tokenId: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload;
}
