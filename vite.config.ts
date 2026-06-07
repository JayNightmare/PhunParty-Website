/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const apiTarget = env.VITE_API_URL || "https://api.phun.party";
    const wsTarget = (env.VITE_WS_URL || "ws://localhost:8000").replace(
        /^ws/,
        "http"
    );

    return {
        plugins: [react()],
        resolve: { alias: { "@": path.resolve(__dirname, "src") } },
        test: {
            environment: "jsdom",
            setupFiles: "./src/setupTests.ts",
            css: true,
        },
        server: {
            port: 5173,
            strictPort: true,
            proxy: {
                "/api": {
                    target: apiTarget,
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/api/, ""),
                    configure: (proxy, _options) => {
                        proxy.on("error", (err, _req, _res) => {
                            console.log("HTTP proxy error", err);
                        });
                        proxy.on("proxyReq", (proxyReq, req, _res) => {
                            console.log(
                                "Sending Request to the Target:",
                                req.method,
                                req.url
                            );
                        });
                        proxy.on("proxyRes", (proxyRes, req, _res) => {
                            console.log(
                                "Received Response from the Target:",
                                proxyRes.statusCode,
                                req.url
                            );
                        });
                    },
                },
                "/ws": {
                    target: wsTarget,
                    changeOrigin: true,
                    ws: true,
                    configure: (proxy, _options) => {
                        proxy.on("error", (err, _req, _res) => {
                            console.log("WebSocket proxy error", err);
                        });
                        proxy.on(
                            "proxyReqWs",
                            (proxyReq, req, socket, options, head) => {
                                console.log("WebSocket proxy request:", req.url);
                            }
                        );
                    },
                },
            },
        },
    };
});
