import path from 'node:path'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import { importDevPlugin } from './scripts/import-dev.ts'

// https://vite.dev/config/
export default defineConfig({
  // Portable across project Pages paths and custom domains.
  base: './',
  plugins: [
    importDevPlugin(),
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  worker: {
    format: 'es',
  },
})
