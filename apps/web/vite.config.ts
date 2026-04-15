import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.VITE_API_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Replit proxies the dev server through *.replit.dev / *.repl.co domains.
    // Vite blocks unknown Hosts by default, so allow any.
    allowedHosts: true,
    hmr: {
      clientPort: 443,
    },
    proxy: {
      '/proofs': { target: API_TARGET, changeOrigin: true },
      '/health': { target: API_TARGET, changeOrigin: true },
    },
  },
});
