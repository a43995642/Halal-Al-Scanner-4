
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom plugin to copy root assets (icon.png, manifest.json) to dist/
const copyRootAssets = () => {
  return {
    name: 'copy-root-assets',
    closeBundle: async () => {
      // Removed privacy.html from here because it's now handled by rollupOptions.input below
      const filesToCopy = ['icon.png', 'manifest.json', 'service-worker.js'];
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
      copyRootAssets() // Activate the copier plugin
    ],
    // This is critical for Android/Capacitor:
    // It ensures assets are loaded from './' instead of '/'
    base: './',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          privacy: path.resolve(__dirname, 'privacy.html') // Treat privacy.html as a separate entry point
        }
      }
    },
    server: {
      port: 3000,
      host: true // Allow network access for testing on phone
    }
  };
});
