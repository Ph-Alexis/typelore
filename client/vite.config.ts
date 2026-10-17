import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const clientPort = Number(process.env.DEV_CLIENT_PORT ?? 5173);
const serverPort = Number(process.env.PORT ?? 3001);

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: clientPort,
    strictPort: true,
    proxy: {
      "/socket.io": {
        target: `http://localhost:${serverPort}`,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
  },
});
