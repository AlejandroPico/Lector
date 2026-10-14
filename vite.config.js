import { defineConfig } from 'vite'
import {ocrAssets} from './ocr-assets.js'

export default defineConfig({
  base: './',
  plugins:[ocrAssets()],
  // Prepare the worker's dependency before the first page loads. Discovering
  // it during OCR otherwise triggers Vite's reload and discards the draft.
  optimizeDeps:{include:['tesseract.js']},
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: ['index.html','receptor.html','sincronizacion.html'],
      output: {
        assetFileNames: asset => asset.names?.includes('favicon.svg')
          ? 'favicon.svg' : 'assets/[name]-[hash][extname]',
      },
    },
  },
  test: { environment: 'jsdom', include: ['tests/**/*.test.js'] },
})
