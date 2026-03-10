import { db, platformRoles, platformUserRoles } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export async function loadUserPlatformRoles(userId: string): Promise<string[]> {
  const rows = await db
    .select({ code: platformRoles.code })
    .from(platformUserRoles)
    .innerJoin(
      platformRoles,
      eq(platformRoles.id, platformUserRoles.platformRoleId),
    )
    .where(
      and(
        eq(platformUserRoles.userId, userId),
        eq(platformUserRoles.isActive, true),
        eq(platformRoles.isActive, true),
      ),
    );

  return rows.map((r) => r.code);
}
