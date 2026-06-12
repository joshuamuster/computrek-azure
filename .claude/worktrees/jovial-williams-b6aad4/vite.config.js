import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { execSync } from 'child_process';

const gitRoot = path.dirname(execSync('git rev-parse --git-common-dir').toString().trim());

export default defineConfig({
  envDir: gitRoot,
  plugins: [vue()],
  server: {
    port: 1701,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.pptx'],
  build: {
    chunkSizeWarningLimit: 650, // Firebase Firestore is inherently ~600 kB minified
    rollupOptions: {
      output: {
        manualChunks: {
          // Firebase split into its own chunk — large but only loaded once and cached
          'vendor-firebase': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/storage',
          ],
          // Chess libs only needed on chess routes
          'vendor-chess': ['chess.js', 'chessground'],
          // Vue core
          'vendor-vue': ['vue', 'vue-router'],
        },
      },
    },
  },
});
