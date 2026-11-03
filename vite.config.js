import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { infisicalPlugin } from './infisical.plugin.js'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    hmr: {
      clientPort: 5173,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    // Carga secretos de Infisical cuyo nombre empiece con "F_"
    // y los expone como import.meta.env.VITE_* en el bundle.
    // Ejemplo: F_API_URL en Infisical → import.meta.env.VITE_API_URL en el código
    infisicalPlugin({ prefix: 'F_' }),
    react(),
  ],
  esbuild: {
    // Elimina console.log y debugger del bundle de producción (preserva console.error y console.warn para depuración y Sentry)
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  build: {
    // Desactivar Source Maps en producción para no exponer código fuente (.jsx) en DevTools
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Separar vendor chunks grandes
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react', 'react-hot-toast', 'sweetalert2'],
          'charts': ['recharts'],
          'pdf': ['html2pdf.js'],
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Aumentar límite de advertencia a 1MB
  },
})
