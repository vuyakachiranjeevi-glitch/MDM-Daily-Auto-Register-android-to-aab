import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, Plugin} from 'vite';

function mirrorDistToBuildPlugin(): Plugin {
  return {
    name: 'mirror-dist-to-build',
    closeBundle() {
      try {
        const distDir = path.resolve(__dirname, 'dist');
        const buildDir = path.resolve(__dirname, 'build');
        if (fs.existsSync(distDir)) {
          if (!fs.existsSync(buildDir)) {
            fs.mkdirSync(buildDir, { recursive: true });
          }
          fs.cpSync(distDir, buildDir, { recursive: true });
        }
      } catch (e) {
        console.error('Failed to mirror dist to build:', e);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), mirrorDistToBuildPlugin()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
