import { db, clients, type InsertClient } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { NotFoundError, AppError } from "../lib/errors";

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
  delete (data as Record<string, unknown>).archivedAt;

  const [client] = await db
    .update(clients)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(clients.id, id), eq(clients.companyId, companyId), isNull(clients.archivedAt)))
    .returning();

  if (!client) {
    throw new NotFoundError("Client not found or archived");
  }
  return client;
}

export async function archiveClient(id: string, companyId: string) {
  const [client] = await db
    .update(clients)
    .set({ archivedAt: new Date(), updatedAt: new Date(), status: "archived" })
    .where(and(eq(clients.id, id), eq(clients.companyId, companyId), isNull(clients.archivedAt)))
    .returning();

  if (!client) {
    throw new NotFoundError("Client not found or already archived");
  }
  return client;
}

export async function restoreClient(id: string, companyId: string) {
  const [current] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.companyId, companyId)))
    .limit(1);

  if (!current) throw new NotFoundError("Client not found");
  if (!current.archivedAt) throw new AppError(422, "Client is not archived", "NOT_ARCHIVED");

  const [client] = await db
    .update(clients)
    .set({ archivedAt: null, status: "active", updatedAt: new Date() })
    .where(and(eq(clients.id, id), eq(clients.companyId, companyId)))
    .returning();

  return client;
}

export async function listClients(companyId: string) {
  return db
    .select()
    .from(clients)
    .where(eq(clients.companyId, companyId));
}
