import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/accounting-assistant-merchant-ledger/",
  plugins: [react()],
});
