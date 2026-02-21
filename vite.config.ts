/// <reference types="vitest" />
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Force tests to use the root node_modules copy of better-sqlite3 (compiled
// for the dev Node version) instead of openclaw-plugin/node_modules copy
// (compiled for the openclaw gateway's bundled Node).
const betterSqlite3Alias = {
  'better-sqlite3': path.resolve(__dirname, 'node_modules/better-sqlite3'),
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    projects: [
      {
        resolve: { alias: betterSqlite3Alias },
        plugins: [react()],
        test: {
          name: 'unit',
          environment: 'node',
          globals: true,
          setupFiles: ['tests/setup.ts'],
          include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
          exclude: ['tests/ui/**'],
        },
      },
      {
        resolve: { alias: betterSqlite3Alias },
        plugins: [react()],
        test: {
          name: 'ui',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['tests/setup.ts'],
          include: ['tests/ui/**/*.test.tsx'],
        },
      },
    ],
  },
})
