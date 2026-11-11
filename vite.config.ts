import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {validateCloudFrontend} from './scripts/cloud-frontend-config.mts';

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, process.cwd(), "VITE_"),
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key.startsWith("VITE_")),
    ),
  };
  const portIndex = process.argv.indexOf("--port");
  const cloud=validateCloudFrontend(env,mode,process.env.VERCEL==='1');
  const devPort = portIndex >= 0 ? process.argv[portIndex + 1] : "1420";
  // Reject privileged keys before Vite can copy an environment value into a browser bundle.
  for (const [name, value] of Object.entries(env)) {
    let privileged = value?.startsWith("sb_secret_") ?? false;
    if (value?.split(".").length === 3) {
      try {
        privileged ||=
          JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString())
            .role === "service_role";
      } catch {
        /* Not a JWT. */
      }
    }
    if (privileged)
      throw new Error(
        `${name} contains a privileged server credential. Remove it from every VITE_ variable.`,
      );
  }
  return {
    // Concurrent counter, staff and authorization-test servers must not invalidate each other's optimized modules.
    cacheDir: `node_modules/.vite/${mode}-${env.VITE_BUNDLED_MOBILE === "true" ? "staff" : "counter"}-${devPort}`,
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "staff-entry",
        transformIndexHtml: {
          order: "pre",
          handler: (html) => {
            if(cloud && env.VITE_DEPLOYMENT_ENV==='staging') html=html.replace('</head>','<meta name="robots" content="noindex, noarchive, nofollow" /></head>');
            return env.VITE_BUNDLED_MOBILE === "true"
              ? html.replace("/src/bootstrap.ts", "/src/mobile-bootstrap.ts")
              : html;
          },
        },
      },
    ],
    clearScreen: false,
    // PDF QR rendering must not trigger a first-use reload during an active sale.
    optimizeDeps: { include: ["react-dom/server"] },
    server: {
      hmr: process.env.TAHA_TEST_NO_HMR === '1' ? false : undefined,
      port: 1420,
      strictPort: true,
      // Generated reports contain HTML; watching them would reload a live counter sale.
      watch: {
        ignored: [
          "**/playwright-report/**",
          "**/test-results*/**",
          "**/.test-postgres/**",
          "**/.tools/**",
          "**/mobile/android/**",
          "**/server/**",
          "**/dist-demo/**",
          "**/dist-mobile/**",
          "**/artifacts/**",
          "**/docs/screenshots/**",
          "**/docs/**",
          "**/tests/**",
          "**/src-tauri/**",
        ],
      },
      proxy: {
        "/api": process.env.TAHA_DEV_API_TARGET || "http://127.0.0.1:3001",
        "/socket.io": {
          target: process.env.TAHA_DEV_API_TARGET || "http://127.0.0.1:3001",
          ws: true,
        },
      },
    },
    envPrefix: ["VITE_", "TAURI_ENV_*"],
    build: {
      target: "es2021",
      sourcemap: false,
      rollupOptions: {
        input: env.VITE_BUNDLED_MOBILE === "true" ? "index.html" : {main:"index.html",splash:"splash.html"},
        output: {
          manualChunks: {
            "react-vendor": [
              "react",
              "react-dom",
              "react-dom/client",
              "react-router-dom",
            ],
            motion: ["framer-motion"],
            "ui-primitives": [
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
            ],
            ...(env.VITE_BUNDLED_MOBILE === "true"
              ? {}
              : { "supabase-vendor": ["@supabase/supabase-js"] }),
            "local-data": ["dexie", "fuse.js"],
            "query-cache": ["@tanstack/react-query"],
          },
        },
      },
    },
  };
});
