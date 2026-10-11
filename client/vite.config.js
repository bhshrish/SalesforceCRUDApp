import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],

    server: {
        allowedHosts: [
            "chunk-astronaut-liqueur.ngrok-free.dev"
        ],
        proxy: {
            "/api": {
                target: "https://chunk-astronaut-liqueur.ngrok-free.dev",
                changeOrigin: true
            }
        }
    }
});