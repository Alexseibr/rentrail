import { db, attachments } from "@workspace/db";
import { eq, and } from "drizzle-orm";

interface CreateAttachmentParams {
  companyId: string;
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  objectPath: string;
  tag?: string;
  notes?: string;
  uploadedBy?: string;
  capturedAt?: Date;
}

export async function createAttachment(params: CreateAttachmentParams) {
  const [attachment] = await db.insert(attachments).values({
    companyId: params.companyId,
    entityType: params.entityType,
    entityId: params.entityId,
    fileName: params.fileName,
    mimeType: params.mimeType,
    fileSize: params.fileSize ?? null,
    objectPath: params.objectPath,
    tag: params.tag ?? null,
    notes: params.notes ?? null,
    uploadedBy: params.uploadedBy ?? null,
    capturedAt: params.capturedAt ?? null,
  }).returning();
  return attachment;
}

export async function listAttachments(companyId: string, entityType: string, entityId: string) {
  return db.select().from(attachments).where(
    and(
      eq(attachments.companyId, companyId),
      eq(attachments.entityType, entityType),
      eq(attachments.entityId, entityId),
    ),
  );
}

export async function getAttachment(id: string, companyId: string) {
  const [attachment] = await db.select().from(attachments).where(
    and(eq(attachments.id, id), eq(attachments.companyId, companyId)),
  );
  return attachment;
}

export async function deleteAttachment(id: string, companyId: string) {
  const [deleted] = await db.delete(attachments).where(
    and(eq(attachments.id, id), eq(attachments.companyId, companyId)),
  ).returning();
  return deleted;
}
