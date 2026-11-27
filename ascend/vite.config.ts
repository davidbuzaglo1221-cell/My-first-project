import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
    // The library text changes rarely and React almost never: separate files so an app update downloads only the app code.
    chunkSizeWarningLimit: 1800,
    rollupOptions:
      mode === 'single'
        ? undefined
        : {
            output: {
              manualChunks(id) {
                if (id.includes('node_modules/react')) return 'react'
                if (id.includes('/src/content/')) return 'library'
              },
            },
          },
  },
  server: { host: true, port: 5173 },
}))
