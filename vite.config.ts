import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {readFileSync} from 'fs';

const appVersion = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')).version as string;

export default defineConfig(() => {
  return {
    define: { __APP_VERSION__: JSON.stringify(appVersion) },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          // Dependencies change far less often than app code: separate chunks stay cached across app updates.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/firebase/firestore/') || id.includes('/@firebase/firestore/')) return 'firebase-store';
            if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'firebase-auth';
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react';
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
