import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { MobileShell } from "@/components/mobile/MobileShell";
import { getCurrentAdminUser } from "@/lib/admin/get-current-admin-user";

export const metadata: Metadata = {
  title: {
    default: "Matima Admin",
    template: "%s · Matima Admin",
  },
  appleWebApp: {
    capable: true,
    title: "Matima Admin",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F1923",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function MobileLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await getCurrentAdminUser();

  if (!currentUser) {
    redirect("/auth/login");
  }

  return <MobileShell>{children}</MobileShell>;
}
