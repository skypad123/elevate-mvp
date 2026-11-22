import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Read VITE_* values from the repo-root .env so all apps share one env file.
const envDir = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig(({ mode }) => {
  // DEV_HOST (environment or .env) is the hostname other devices use for this machine. Vite only
  // answers localhost and IP addresses unless a hostname is listed here.
  const devHost = loadEnv(mode, envDir, 'DEV_').DEV_HOST
  return {
    plugins: [react(), tailwindcss()],
    envDir,
    server: {
      port: 5174,
      strictPort: true,
      host: true,
      allowedHosts: devHost ? [devHost] : [],
    },
  }
})
