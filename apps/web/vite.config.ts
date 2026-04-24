import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const devProxyTarget = env.DEV_API_PROXY_TARGET || "http://127.0.0.1:3000"

  return {
    plugins: [
      tanstackRouter({
        target: "react",
        routesDirectory: "./src/pages",
        generatedRouteTree: "./src/routeTree.gen.ts",
        quoteStyle: "double",
        semicolons: false,
      }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: true,
      proxy: {
        "/api": {
          target: devProxyTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (p) => p.replace(/^\/api/, "") || "/",
        },
      },
    },
  }
})
