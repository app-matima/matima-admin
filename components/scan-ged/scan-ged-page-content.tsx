"use client";

import { useState } from "react";
import { ScanGedMjpmSelect } from "@/components/scan-ged/scan-ged-mjpm-select";
import { ScanGedUploadPanel } from "@/components/scan-ged/scan-ged-upload-panel";
import type { ScanGedOrganisation } from "@/types/scan-ged";

interface ScanGedPageContentProps {
  organisations: ScanGedOrganisation[];
}

export function ScanGedPageContent({
  organisations,
}: ScanGedPageContentProps) {
  const [organisationSelectionnee, setOrganisationSelectionnee] =
    useState<ScanGedOrganisation | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium tracking-tight text-text-strong">
        Scan GED
      </h1>

      {!organisationSelectionnee ? (
        <>
          <p className="text-sm text-text-muted">
            Sélectionnez un cabinet MJPM pour importer et classer des documents.
          </p>
          <ScanGedMjpmSelect
            organisations={organisations}
            onSelect={setOrganisationSelectionnee}
          />
        </>
      ) : (
        <ScanGedUploadPanel
          organisation={organisationSelectionnee}
          onChangeMjpm={() => setOrganisationSelectionnee(null)}
        />
      )}
    </div>
  );
}
