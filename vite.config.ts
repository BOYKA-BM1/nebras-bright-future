import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

export default defineConfig({
  vite: {
    plugins: [
      nitro({
        preset: "vercel",   // ← مهم جداً لـ Vercel
      }),
    ],
  },
  // باقي الإعدادات اللي كانت موجودة (server entry إلخ)
  server: { entry: "server" },
});
