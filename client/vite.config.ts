import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

let commitHash = process.env.RENDER_GIT_COMMIT?.slice(0, 7) || 'unknown'
try {
  if (commitHash === 'unknown') {
    commitHash = execSync('git rev-parse --short HEAD').toString().trim()
  }
} catch {
  // git not available in build env
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_COMMIT__: JSON.stringify(commitHash),
  },
})
