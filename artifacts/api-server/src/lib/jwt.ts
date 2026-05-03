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
  return jwt.sign(payload as object, config.jwt.accessSecret as jwt.Secret, {
    expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload as object, config.jwt.refreshSecret as jwt.Secret, {
    expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload;
}
