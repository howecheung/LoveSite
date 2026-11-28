import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// PocketBase 地址只用于开发代理；部署后由同源 /api 直连，可用 PB_URL 覆盖
const PB = process.env.PB_URL || 'http://127.0.0.1:8094'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const APP_VERSION = 'v' + pkg.version
// 每次构建都带新时间戳：版本号相同也能让 Service Worker 换缓存
const STAMP = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
const SW_VERSION = `${pkg.version}-${STAMP}`

// public/ 里的 sw.js 不经过 rollup，构建结束后就地把占位符换成真实版本
function injectServiceWorkerVersion(): Plugin {
  return {
    name: 'inject-sw-version',
    enforce: 'post',
    closeBundle() {
      const file = fileURLToPath(new URL('./dist/sw.js', import.meta.url))
      try {
        const src = readFileSync(file, 'utf8')
        const out = src.split('__SW_VERSION__').join(SW_VERSION)
        writeFileSync(file, out, 'utf8')
        if (out.includes('__SW_VERSION__')) this.warn('sw.js 仍有未替换的版本占位符')
        else console.log(`  sw.js 版本 → ${SW_VERSION}`)
      } catch {
        this.warn('dist/sw.js 不存在，跳过版本注入')
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), injectServiceWorkerVersion()],
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __SW_VERSION__: JSON.stringify(SW_VERSION),
  },
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
          // 地图只在 lazy 的 Footprint 里用，单独分包避免 Leaflet 跟首屏 vendor 一起下载
          if (id.includes('leaflet') || id.includes('@amap')) return 'map'
          return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  server: { proxy: { '/api': PB, '/pb_files': PB } },
})
