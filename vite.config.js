import { defineConfig } from 'vite'
import {ocrAssets} from './ocr-assets.js'

export default defineConfig({
  base: './',
  plugins:[ocrAssets()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        assetFileNames: asset => asset.names?.includes('favicon.svg')
          ? 'favicon.svg' : 'assets/[name]-[hash][extname]',
      },
    },
  },
  test: { environment: 'jsdom', include: ['tests/**/*.test.js'] },
})
