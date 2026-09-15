import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MobilePrestationDetail } from "@/components/mobile/MobilePrestationDetail";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";
import { getPrestationById } from "@/lib/prestations/get-prestations";

export const dynamic = "force-dynamic";

export default async function MobilePrestationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    redirect("/auth/login");
  }

  const { id } = await params;
  const prestation = await getPrestationById(id);

  if (!prestation) {
    notFound();
  }

  return (
    <MobilePrestationDetail
      prestation={prestation}
      currentUserRole={currentUser.role}
    />
  );
}
