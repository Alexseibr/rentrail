import { db, clients, type InsertClient } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { NotFoundError } from "../lib/errors";

export async function createClient(data: InsertClient) {
  const [client] = await db.insert(clients).values(data).returning();
  return client;
}

export async function getClient(id: string, companyId: string) {
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.companyId, companyId)))
    .limit(1);

  if (!client) {
    throw new NotFoundError("Client not found");
  }
  return client;
}

export async function updateClient(id: string, companyId: string, data: Partial<InsertClient>) {
  const [client] = await db
    .update(clients)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(clients.id, id), eq(clients.companyId, companyId)))
    .returning();

  if (!client) {
    throw new NotFoundError("Client not found");
  }
  return client;
}

export async function listClients(companyId: string) {
  return db
    .select()
    .from(clients)
    .where(eq(clients.companyId, companyId));
}
