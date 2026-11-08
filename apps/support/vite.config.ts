import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Read VITE_* values from the repo-root .env so all apps share one env file.
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: { port: 5174, strictPort: true, host: true },
})
