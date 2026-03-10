import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { canWrite, isReadOnly } from "@/lib/permissions";

export function useRolePermissions() {
  const { user } = useAuth();

  return useMemo(() => {
    const roleCode = user?.memberships?.[0]?.roleCode;
    return {
      roleCode,
      readOnly: isReadOnly(roleCode),
      canWriteAsset: canWrite(roleCode, "asset"),
      canWriteRental: canWrite(roleCode, "rental"),
      canWriteClient: canWrite(roleCode, "client"),
      canWriteBranch: canWrite(roleCode, "branch"),
      canWriteSettings: canWrite(roleCode, "settings"),
      canWriteService: canWrite(roleCode, "service"),
      canWriteUser: canWrite(roleCode, "user"),
    };
  }, [user]);
}
