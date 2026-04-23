import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {loadEnv} from 'vite';
import {defineConfig} from 'vitest/config';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  const getManualChunk = (id: string): string | undefined => {
    if (!id.includes('node_modules')) {
      return undefined;
    }

    if (id.includes('firebase')) {
      return 'firebase-vendor';
    }
    if (id.includes('jspdf')) {
      return 'jspdf-vendor';
    }
    if (id.includes('html2canvas')) {
      return 'html-image-vendor';
    }
    if (id.includes('recharts') || id.includes('d3-')) {
      return 'chart-vendor';
    }
    if (id.includes('react-simplemde-editor') || id.includes('easymde') || id.includes('codemirror')) {
      return 'editor-vendor';
    }
    if (id.includes('react-markdown') || id.includes('rehype') || id.includes('remark')) {
      return 'markdown-vendor';
    }
    if (id.includes('i18next') || id.includes('react-i18next')) {
      return 'i18n-vendor';
    }
    if (id.includes('lunar-javascript') || id.includes('luxon') || id.includes('tz-lookup')) {
      return 'saju-vendor';
    }
    if (id.includes('framer-motion')) {
      return 'motion-vendor';
    }
    if (id.includes('lucide-react')) {
      return 'lucide-vendor';
    }
    if (id.includes('react-dom')) {
      return 'react-vendor';
    }

    return undefined;
  };

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: getManualChunk,
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
    },
    test: {
      exclude: ['e2e/**', 'test-results/**', 'node_modules/**', 'dist/**'],
    },
  };
});
