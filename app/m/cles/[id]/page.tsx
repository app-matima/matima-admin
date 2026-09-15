import { notFound, redirect } from "next/navigation";
import { MobileCleDetail } from "@/components/mobile/MobileCleDetail";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { getCleById } from "@/lib/cles/get-cles-data";

export const dynamic = "force-dynamic";

export default async function MobileCleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    redirect("/auth/login");
  }

  if (currentUser.role !== "admin") {
    redirect("/m/prestations");
  }

  const { id } = await params;
  const cle = await getCleById(id);

  if (!cle) {
    notFound();
  }

  return <MobileCleDetail cle={cle} />;
}
