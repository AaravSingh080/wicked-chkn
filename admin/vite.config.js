import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/admin/', // served under /admin in production (see server/src/index.js)
  plugins: [react()],
  server: {
    port: 5274,
    proxy: {
      '/api': { target: 'http://localhost:4100', changeOrigin: true }
    }
  }
});
