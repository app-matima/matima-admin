import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import type { AdminUser } from "@/types/admin";

export async function requireScanGedAccess(): Promise<AdminUser | null> {
  const currentUser = await getCurrentAdminUser();

  if (
    !currentUser ||
    (currentUser.role !== "admin" && currentUser.role !== "administratif")
  ) {
    return null;
  }

  return currentUser;
}
