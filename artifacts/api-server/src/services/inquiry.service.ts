import {
  db,
  inquiries,
  clients,
  rentals,
  branches,
  stations,
  assets,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { NotFoundError, AppError } from "../lib/errors";
import { checkClientBlacklist } from "./blacklist.service";

type InquiryStatus = typeof inquiries.$inferSelect.status;

const INQUIRY_STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ["in_review", "contacted", "rejected", "spam", "archived"],
  in_review: ["contacted", "converted", "rejected", "spam", "archived"],
  contacted: ["converted", "rejected", "archived"],
  converted: [],
  rejected: ["archived"],
  spam: ["archived"],
  archived: [],
};

async function validateForeignKeys(
  companyId: string,
  data: { branchId?: string; stationId?: string; preferredAssetId?: string },
) {
  if (data.branchId) {
    const [branch] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(
        and(eq(branches.id, data.branchId), eq(branches.companyId, companyId)),
      )
      .limit(1);
    if (!branch)
      throw new AppError(
        422,
        "Branch does not belong to this company",
        "INVALID_BRANCH",
      );
  }
  if (data.stationId) {
    const [station] = await db
      .select({ id: stations.id })
      .from(stations)
      .where(
        and(eq(stations.id, data.stationId), eq(stations.companyId, companyId)),
      )
      .limit(1);
    if (!station)
      throw new AppError(
        422,
        "Station does not belong to this company",
        "INVALID_STATION",
      );
  }
  if (data.preferredAssetId) {
    const [asset] = await db
      .select({ id: assets.id })
      .from(assets)
      .where(
        and(
          eq(assets.id, data.preferredAssetId),
          eq(assets.companyId, companyId),
        ),
      )
      .limit(1);
    if (!asset)
      throw new AppError(
        422,
        "Asset does not belong to this company",
        "INVALID_ASSET",
      );
  }
}

export async function createPublicInquiry(
  companyId: string,
  data: {
    branchId?: string;
    stationId?: string;
    fullName: string;
    phone: string;
    email?: string;
    assetType?: string;
    preferredAssetId?: string;
    requestedStartAt?: Date;
    requestedEndAt?: Date;
    message?: string;
  },
) {
  await validateForeignKeys(companyId, data);

  let blacklistCheckResult: {
    isBlacklisted: boolean;
    entries: Array<{ actionType: string; reasonCode: string }>;
  } | null = null;

  const existingClients = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.companyId, companyId), eq(clients.phone, data.phone)))
    .limit(1);

  if (existingClients.length > 0) {
    const result = await checkClientBlacklist(
      existingClients[0].id,
      companyId,
      data.branchId,
    );
    blacklistCheckResult = {
      isBlacklisted: result.isBlacklisted,
      entries: result.entries.map((e) => ({
        actionType: e.actionType,
        reasonCode: e.reasonCode,
      })),
    };
  }

  const [inquiry] = await db
    .insert(inquiries)
    .values({
      companyId,
      branchId: data.branchId ?? null,
      stationId: data.stationId ?? null,
      source: "public_inquiry",
      fullName: data.fullName.trim(),
      phone: data.phone.trim(),
      email: data.email?.trim().toLowerCase() ?? null,
      assetType: data.assetType ?? null,
      preferredAssetId: data.preferredAssetId ?? null,
      requestedStartAt: data.requestedStartAt ?? null,
      requestedEndAt: data.requestedEndAt ?? null,
      message: data.message?.trim() ?? null,
      blacklistCheckResult,
    })
    .returning();

  return inquiry;
}

export async function getInquiry(id: string, companyId: string) {
  const [inquiry] = await db
    .select()
    .from(inquiries)
    .where(and(eq(inquiries.id, id), eq(inquiries.companyId, companyId)))
    .limit(1);
  if (!inquiry) throw new NotFoundError("Inquiry not found");
  return inquiry;
}

export async function listInquiries(companyId: string, status?: string) {
  const conditions = [eq(inquiries.companyId, companyId)];
  if (status) {
    const validStatuses = [
      "new",
      "in_review",
      "contacted",
      "converted",
      "rejected",
      "spam",
      "archived",
    ];
    if (!validStatuses.includes(status))
      throw new AppError(400, "Invalid status filter", "INVALID_STATUS");
    conditions.push(eq(inquiries.status, status as InquiryStatus));
  }
  return db
    .select()
    .from(inquiries)
    .where(and(...conditions));
}

export async function updateInquiry(
  id: string,
  companyId: string,
  data: Partial<{
    fullName: string;
    phone: string;
    email: string;
    message: string;
    assetType: string;
  }>,
) {
  const [updated] = await db
    .update(inquiries)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(inquiries.id, id), eq(inquiries.companyId, companyId)))
    .returning();
  if (!updated) throw new NotFoundError("Inquiry not found");
  return updated;
}

function validateInquiryTransition(from: string, to: string) {
  const allowed = INQUIRY_STATUS_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new AppError(
      422,
      `Cannot transition inquiry from '${from}' to '${to}'`,
      "INVALID_STATUS_TRANSITION",
    );
  }
}

async function changeInquiryStatus(
  id: string,
  companyId: string,
  newStatus: string,
  userId?: string,
) {
  const inquiry = await getInquiry(id, companyId);
  validateInquiryTransition(inquiry.status, newStatus);

  const [updated] = await db
    .update(inquiries)
    .set({
      status: newStatus as InquiryStatus,
      processedByUserId: userId ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(inquiries.id, id), eq(inquiries.companyId, companyId)))
    .returning();
  return updated;
}

export async function markContacted(
  id: string,
  companyId: string,
  userId: string,
) {
  return changeInquiryStatus(id, companyId, "contacted", userId);
}

export async function rejectInquiry(
  id: string,
  companyId: string,
  userId: string,
) {
  return changeInquiryStatus(id, companyId, "rejected", userId);
}

export async function convertToClient(
  id: string,
  companyId: string,
  userId: string,
) {
  const inquiry = await getInquiry(id, companyId);
  validateInquiryTransition(inquiry.status, "converted");

  const [existingClient] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(eq(clients.companyId, companyId), eq(clients.phone, inquiry.phone)),
    )
    .limit(1);

  let clientId: string;
  if (existingClient) {
    clientId = existingClient.id;
  } else {
    const [newClient] = await db
      .insert(clients)
      .values({
        companyId,
        fullName: inquiry.fullName,
        phone: inquiry.phone,
        email: inquiry.email,
      })
      .returning();
    clientId = newClient.id;
  }

  const [updated] = await db
    .update(inquiries)
    .set({
      status: "converted" as InquiryStatus,
      convertedClientId: clientId,
      processedByUserId: userId,
      updatedAt: new Date(),
    })
    .where(and(eq(inquiries.id, id), eq(inquiries.companyId, companyId)))
    .returning();

  return updated;
}

export async function convertToRentalDraft(
  id: string,
  companyId: string,
  userId: string,
) {
  const inquiry = await getInquiry(id, companyId);

  if (!inquiry.convertedClientId) {
    throw new AppError(
      422,
      "Inquiry must be converted to client first",
      "CLIENT_NOT_CREATED",
    );
  }

  if (inquiry.convertedRentalId) {
    throw new AppError(
      409,
      "Inquiry already has a rental draft",
      "ALREADY_CONVERTED",
    );
  }

  if (!inquiry.preferredAssetId) {
    throw new AppError(
      422,
      "Cannot create rental draft without an asset. Set preferredAssetId on the inquiry first.",
      "MISSING_ASSET",
    );
  }

  const rentalData: Record<string, unknown> = {
    companyId,
    clientId: inquiry.convertedClientId,
    branchId: inquiry.branchId ?? null,
    stationId: inquiry.stationId ?? null,
    assetId: inquiry.preferredAssetId,
    issuedByUserId: userId,
    startAt: inquiry.requestedStartAt ?? null,
    plannedEndAt: inquiry.requestedEndAt ?? null,
    notes: `Created from inquiry ${inquiry.id}`,
  };

  const [rental] = await db
    .insert(rentals)
    .values(rentalData as typeof rentals.$inferInsert)
    .returning();

  await db
    .update(inquiries)
    .set({ convertedRentalId: rental.id, updatedAt: new Date() })
    .where(and(eq(inquiries.id, id), eq(inquiries.companyId, companyId)));

  return { inquiry: await getInquiry(id, companyId), rental };
}
