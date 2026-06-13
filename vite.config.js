import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';

const require  = createRequire(import.meta.url);
const gitRoot  = path.dirname(execSync('git rev-parse --git-common-dir').toString().trim());
const { major, minor, patch } = require('./version.json');

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(`${major}.${minor}.${patch}`),
  },
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
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          // Chess libs only needed on chess routes
          'vendor-chess': ['chessground', 'chessops'],
          // Vue core
          'vendor-vue': ['vue', 'vue-router'],
          // Azure auth (MSAL is ~400 kB — split so it's cached separately)
          'vendor-msal': ['@azure/msal-browser'],
        },
      },
    },
  },
});
