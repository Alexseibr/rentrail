import { getAccessToken, getCompanyId, getBranchId } from "./api";
import type { CapturedMedia } from "./media";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface UploadResult {
  success: boolean;
  objectPath?: string;
  error?: string;
}

interface AttachmentResult {
  success: boolean;
  attachment?: Record<string, unknown>;
  error?: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  const companyId = await getCompanyId();
  const branchId = await getBranchId();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (companyId) headers["x-company-id"] = companyId;
  if (branchId) headers["x-branch-id"] = branchId;
  return headers;
}

export async function uploadFile(media: CapturedMedia): Promise<UploadResult> {
  try {
    const headers = await getAuthHeaders();

    const urlRes = await fetch(`${BASE_URL}/api/storage/uploads/request-url`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: media.fileName,
        size: media.fileSize ?? 0,
        contentType: media.mimeType,
      }),
    });

    if (!urlRes.ok) {
      const errText = await urlRes.text();
      return { success: false, error: `Failed to get upload URL: ${errText}` };
    }

    const { uploadURL, objectPath } = await urlRes.json();

    const fileResponse = await fetch(media.uri);
    const blob = await fileResponse.blob();

    const uploadRes = await fetch(uploadURL, {
      method: "PUT",
      headers: { "Content-Type": media.mimeType },
      body: blob,
    });

    if (!uploadRes.ok) {
      return { success: false, error: `Upload failed: HTTP ${uploadRes.status}` };
    }

    return { success: true, objectPath };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed",
    };
  }
}

export async function createAttachmentRecord(params: {
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  objectPath: string;
  tag?: string;
  notes?: string;
  capturedAt?: string;
}): Promise<AttachmentResult> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/attachments`, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: errText };
    }

    const { data } = await res.json();
    return { success: true, attachment: data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create attachment",
    };
  }
}

export async function uploadAndAttach(params: {
  media: CapturedMedia;
  entityType: string;
  entityId: string;
  tag?: string;
  notes?: string;
}): Promise<AttachmentResult> {
  const uploadResult = await uploadFile(params.media);
  if (!uploadResult.success || !uploadResult.objectPath) {
    return { success: false, error: uploadResult.error };
  }

  return createAttachmentRecord({
    entityType: params.entityType,
    entityId: params.entityId,
    fileName: params.media.fileName,
    mimeType: params.media.mimeType,
    fileSize: params.media.fileSize,
    objectPath: uploadResult.objectPath,
    tag: params.tag,
    notes: params.notes,
    capturedAt: params.media.capturedAt,
  });
}
