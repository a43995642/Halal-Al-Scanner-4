
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom plugin to copy root assets (icon.png, manifest.json, etc.) to dist/
const copyRootAssets = () => {
  return {
    name: 'copy-root-assets',
    closeBundle: async () => {
      const filesToCopy = ['icon.png', 'manifest.json', 'service-worker.js', 'privacy.html', 'delete-account.html'];
      const distDir = path.resolve(__dirname, 'dist');
      
      if (!fs.existsSync(distDir)) return;

      filesToCopy.forEach(file => {
        const srcPath = path.resolve(__dirname, file);
        const destPath = path.join(distDir, file);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
          console.log(`[Asset Copier] Copied ${file} to dist/`);
        }
      });
    }
  };
};

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      react(),
      copyRootAssets()
    ],
    // Ensure relative paths for Android WebView
    base: './',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      minify: 'esbuild',
      target: 'es2020',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
        },
        output: {
          // Manual chunks to separate vendor code (React, etc) from app code
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              if (id.includes('@capacitor')) {
                return 'vendor-capacitor';
              }
              return 'vendor-libs';
            }
          }
        }
      }
    },
    server: {
      port: 3000,
      host: true
    }
  };
});
