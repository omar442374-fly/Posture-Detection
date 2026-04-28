import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Fallback vite config for renderer-only dev mode
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/test/**']
    }
  }
})
