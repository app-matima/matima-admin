import type { MetadataRoute } from "next";

/**
 * Manifest PWA Matima Admin — expérience mobile dédiée (`/m`).
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Matima Admin",
    short_name: "Matima Admin",
    description:
      "Administration Matima — prestations et planning",
    start_url: "/m",
    scope: "/m",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0F1923",
    theme_color: "#00A394",
    lang: "fr",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
