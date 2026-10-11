import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

function pwaAssetsPlugin(): import("vite").Plugin {
  return {
    name: "pwa-assets-generator",
    apply: "build",
    generateBundle(_options, bundle) {
      const assetUrls = Object.keys(bundle)
        .filter((file) => !file.endsWith(".map") && file !== "sw-assets.json")
        .map((file) => (file.startsWith("/") ? file : `/${file}`));

      this.emitFile({
        type: "asset",
        fileName: "sw-assets.json",
        source: JSON.stringify(assetUrls, null, 2),
      });
    },
  };
}

export default defineConfig({
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  server: { host: "0.0.0.0", port: 3000, strictPort: true, allowedHosts: true },
  preview: {
    host: "0.0.0.0",
    port: process.env["PORT"] ? parseInt(process.env["PORT"], 10) : 3000,
    allowedHosts: true,
  },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    react(),
    pwaAssetsPlugin(),
  ],
});
