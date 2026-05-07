import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db, clients } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { signAccessToken } from "../lib/jwt";
import { config } from "../lib/config";
import { UnauthorizedError } from "../lib/errors";

function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/-/g, "");
}

export async function clientLoginWithPassword(
  rawPhone: string,
  password: string,
  companyId?: string,
) {
  const phone = normalizePhone(rawPhone);

  const conditions = companyId
    ? and(eq(clients.phone, rawPhone), eq(clients.companyId, companyId))
    : eq(clients.phone, rawPhone);

  let matchingClients = await db.select().from(clients).where(conditions);

  if (matchingClients.length === 0 && phone !== rawPhone) {
    const conditionsNorm = companyId
      ? and(eq(clients.phone, phone), eq(clients.companyId, companyId))
      : eq(clients.phone, phone);
    matchingClients = await db.select().from(clients).where(conditionsNorm);
  }

  const client =
    matchingClients.find((c) => c.status === "active") ?? matchingClients[0];

  if (!client) {
    throw new UnauthorizedError("Invalid phone number or password");
  }

  if (!client.passwordHash) {
    throw new UnauthorizedError("Password not set for this client account");
  }

  if (client.status !== "active") {
    throw new UnauthorizedError("Account is suspended or blocked");
  }

  const isValid = await bcrypt.compare(password, client.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError("Invalid phone number or password");
  }

  const accessToken = signAccessToken({
    userId: client.id,
    isSuperAdmin: false,
    platformRoles: [],
    clientId: client.id,
    companyId: client.companyId,
    tokenType: "client",
  });

  const refreshToken = jwt.sign(
    {
      clientId: client.id,
      companyId: client.companyId,
      tokenType: "client-refresh",
    },
    config.jwt.refreshSecret,
    { expiresIn: "30d" },
  );

  return {
    accessToken,
    refreshToken,
    user: {
      id: client.id,
      clientId: client.id,
      companyId: client.companyId,
      fullName: client.fullName,
      phone: client.phone,
      email: client.email,
      tokenType: "client" as const,
    },
  };
}

export async function getClientProfile(clientId: string) {
  const [client] = await db
    .select({
      id: clients.id,
      companyId: clients.companyId,
      fullName: clients.fullName,
      phone: clients.phone,
      email: clients.email,
      status: clients.status,
      rating: clients.rating,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) return null;

  return {
    ...client,
    tokenType: "client" as const,
  };
}
