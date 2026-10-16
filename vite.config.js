import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
