import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://localhost:3000',
      '/parcels': 'http://localhost:3000',
      '/users': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
});
