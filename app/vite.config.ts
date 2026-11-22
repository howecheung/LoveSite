import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PocketBase 地址只用于开发代理；部署后由同源 /api 直连，可用 PB_URL 覆盖
const PB = process.env.PB_URL || 'http://127.0.0.1:8094'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    // 首屏只带框架与 UI；三款游戏由 App.tsx 动态 import，各自独立分包
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react'
          if (id.includes('animal-island-ui')) return 'ui'
          if (id.includes('motion')) return 'motion'
          if (id.includes('pocketbase')) return 'pocketbase'
          return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  server: { proxy: { '/api': PB, '/pb_files': PB } },
})
