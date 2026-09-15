import { IosInstallBanner } from "@/components/mobile/IosInstallBanner";
import { MobileTabBar } from "@/components/mobile/MobileTabBar";
import { RegisterServiceWorker } from "@/components/mobile/RegisterServiceWorker";

/**
 * Coquille mobile PWA : bandeau iOS éventuel + contenu + bottom tab bar.
 * Hors du layout desktop `(admin)` — pas de sidebar.
 */
export function MobileShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh flex-col bg-page pt-[env(safe-area-inset-top)]">
      <RegisterServiceWorker />
      <IosInstallBanner />
      <main className="flex-1 px-4 pb-[calc(3.5rem+env(safe-area-inset-bottom))] pt-4">
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}
