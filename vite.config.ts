import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const repo = process.env.REPO_NAME || "phunparty";

export default defineConfig({
    plugins: [react()],
    base: `/${repo}/`,
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    test: {
        environment: "jsdom",
        setupFiles: "./src/setupTests.ts",
        css: true,
    },
});
