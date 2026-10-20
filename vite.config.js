import { defineConfig } from 'vite'
import {ocrAssets} from './ocr-assets.js'
import {dictionaryAssets} from './dictionary-assets.js'
import {foliateCamera} from './foliate-camera.js'

export default defineConfig({
  base: './',
  server: {watch: {ignored: ['**/android/**','**/ios/**','**/desktop/**','**/distribution/**','**/release/**']}},
  plugins:[foliateCamera(),ocrAssets(),dictionaryAssets()],
  // Prepare the worker's dependency before the first page loads. Discovering
  // it during OCR otherwise triggers Vite's reload and discards the draft.
  optimizeDeps:{include:['tesseract.js'],exclude:['foliate-js']},
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: ['index.html','sincronizacion.html','receptor.html'],
      output: {
        assetFileNames: asset => asset.names?.includes('favicon.svg')
          ? 'favicon.svg' : 'assets/[name]-[hash][extname]',
      },
    },
  },
  test: { environment: 'jsdom', include: ['tests/**/*.test.js'] },
})
