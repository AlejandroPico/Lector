import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
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
