import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { infisicalPlugin } from './infisical.plugin.js'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // Carga secretos de Infisical cuyo nombre empiece con "F_"
    // y los expone como import.meta.env.VITE_* en el bundle.
    // Ejemplo: F_API_URL en Infisical → import.meta.env.VITE_API_URL en el código
    infisicalPlugin({ prefix: 'F_' }),
    react(),
  ],
  build: {
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
