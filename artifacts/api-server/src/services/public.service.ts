import { db, companies, companyBranding, assets, stations, branches } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { NotFoundError, AppError } from "../lib/errors";

const PUBLIC_VISIBLE_ASSET_STATUSES = ["available", "reserved"];

export async function resolvePublicCompany(slug: string) {
  const [company] = await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      status: companies.status,
    })
    .from(companies)
    .where(eq(companies.slug, slug))
    .limit(1);

  if (!company) throw new NotFoundError("Company not found");
  if (company.status === "blocked" || company.status === "canceled") {
    throw new NotFoundError("Company not found");
  }

  const [branding] = await db
    .select()
    .from(companyBranding)
    .where(eq(companyBranding.companyId, company.id))
    .limit(1);

  if (!branding?.publicEnabled) {
    throw new NotFoundError("Company public page is not available");
  }

  return { company, branding };
}

export async function getPublicCompanyPage(slug: string) {
  const { company, branding } = await resolvePublicCompany(slug);

  const result: Record<string, unknown> = {
    name: branding.publicTitle ?? company.name,
    slug: company.slug,
    description: branding.publicDescription,
    logoUrl: branding.logoUrl,
    coverImageUrl: branding.coverImageUrl,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    phone: branding.publicPhone,
    email: branding.publicEmail,
    city: branding.publicCity,
    address: branding.publicAddress,
    websiteUrl: branding.websiteUrl,
    socialLinks: branding.socialLinks,
    termsText: branding.publicTermsText,
    showAssets: branding.publicShowAssets,
    showPricing: branding.publicShowPricing,
    showStations: branding.publicShowStations,
    showInquiryForm: branding.publicShowInquiryForm,
    showB2BForm: branding.publicShowB2BForm,
  };

  return result;
}

export async function getPublicAssets(slug: string, filters?: { assetType?: string; branchId?: string; stationId?: string }) {
  const { company, branding } = await resolvePublicCompany(slug);

  if (!branding.publicShowAssets) {
    return [];
  }

  const allAssets = await db
    .select({
      id: assets.id,
      assetType: assets.assetType,
      brand: assets.brand,
      model: assets.model,
      status: assets.status,
      branchId: assets.branchId,
      stationId: assets.stationId,
    })
    .from(assets)
    .where(
      and(
        eq(assets.companyId, company.id),
        eq(assets.isPublic, true),
        isNull(assets.archivedAt),
      ),
    );

  let filtered = allAssets.filter(a => PUBLIC_VISIBLE_ASSET_STATUSES.includes(a.status));

  if (filters?.assetType) filtered = filtered.filter(a => a.assetType === filters.assetType);
  if (filters?.branchId) filtered = filtered.filter(a => a.branchId === filters.branchId);
  if (filters?.stationId) filtered = filtered.filter(a => a.stationId === filters.stationId);

  return filtered.map(a => ({
    id: a.id,
    assetType: a.assetType,
    brand: a.brand,
    model: a.model,
    status: a.status === "available" ? "available" : "reserved",
  }));
}

export async function getPublicStations(slug: string) {
  const { company, branding } = await resolvePublicCompany(slug);

  if (!branding.publicShowStations) {
    return [];
  }

  const rows = await db
    .select({
      id: stations.id,
      name: stations.name,
      type: stations.type,
      address: stations.address,
      lat: stations.lat,
      lng: stations.lng,
      branchId: stations.branchId,
    })
    .from(stations)
    .where(and(eq(stations.companyId, company.id), eq(stations.status, "active")));

  return rows;
}
