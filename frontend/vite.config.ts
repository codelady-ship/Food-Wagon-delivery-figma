import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));
export const PAGES = ["index", "restaurants", "restaurant", "cart", "checkout", "order", "account", "admin", "contact"];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "VITE_");
  const site = (env.VITE_SITE_URL || "https://codelady-ship.github.io/Food-Wagon-delivery-figma/").replace(/\/?$/, "/");
  return {
    base: "./",
    plugins: [
      react(),
      tailwindcss(),
      {
        // %SITE_URL% in the HTML files -> absolute site URL (canonical, OG, JSON-LD)
        name: "site-url",
        transformIndexHtml: (html) => html.replaceAll("%SITE_URL%", site),
      },
    ],
    resolve: { alias: { "@": resolve(root, "src") } },
    server: { fs: { allow: [resolve(root, "..")] } },
    build: {
      rollupOptions: { input: Object.fromEntries(PAGES.map((p) => [p, resolve(root, `${p}.html`)])) },
    },
  };
});
