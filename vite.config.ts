/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    projects: [
      {
        plugins: [react()],
        test: {
          name: 'unit',
          environment: 'node',
          globals: true,
          include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
          exclude: ['tests/ui/**'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'ui',
          environment: 'jsdom',
          globals: true,
          include: ['tests/ui/**/*.test.tsx'],
        },
      },
    ],
  },
})
