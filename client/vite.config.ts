import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildTime = new Date().toLocaleString('ru-RU', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  timeZone: 'Asia/Tashkent',
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD_TIME__: JSON.stringify(buildTime),
  },
})
