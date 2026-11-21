import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: { outDir: 'dist', minify: false },
  server: { proxy: { '/api': 'http://127.0.0.1:8094', '/pb_files': 'http://127.0.0.1:8094' } },
})
