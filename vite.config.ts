import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/n8n-visual-pipeline/',
  plugins: [react()],
  server: {
    port: 5175,
    open: false
  }
});
