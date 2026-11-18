/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Versión de esta compilación: va dentro de la app y en version.json (la app avisa cuando hay una más nueva). */
const VERSION = new Date().toISOString()

export default defineConfig({
  // Rutas relativas: la app funciona en cualquier subcarpeta (p. ej. GitHub Pages /nexora/)
  base: './',
  plugins: [react(), { name: 'version', generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VERSION }) }) } }],
  define: { __VERSION__: JSON.stringify(VERSION) },
  test: { include: ['src/tests/**/*.test.ts'] },
  build: { chunkSizeWarningLimit: 2500 },
  worker: { format: 'es' },
})
