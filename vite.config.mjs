import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'lucide': ['lucide-react'],
          'supabase': ['@supabase/supabase-js'],
          'ffmpeg': ['ffmpeg-static', 'fluent-ffmpeg'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});