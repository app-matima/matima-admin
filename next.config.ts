import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Modules natifs / ESM pdf.js — ne pas bundler côté serveur
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
};

export default nextConfig;
