import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import statsHandler from './api/stats.ts'
import galleryHandler from './api/gallery.ts'
import { resolve } from 'node:path'

function siteStatsApi(): Plugin {
  const configure = (server: Pick<ViteDevServer, 'middlewares'>) => {
    server.middlewares.use((request, response, next) => {
      if (request.url?.split('?')[0] === '/api/stats') void statsHandler(request, response)
      else if (request.url?.split('?')[0] === '/api/gallery') void galleryHandler(request, response)
      else next()
    })
  }
  return { name: 'site-stats-api', configureServer: configure, configurePreviewServer: configure }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['GA_', 'GALLERY_'])
  for (const [key, value] of Object.entries(env)) process.env[key] ??= value
  const galleryDirectory = resolve(process.env.GALLERY_LOCAL_DIR || '.gallery-data.local').replaceAll('\\', '/')
  return {
    plugins: [vue(), siteStatsApi()],
    server: { fs: { deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/.gallery-data.local/**', `${galleryDirectory}/**`] } },
  }
})
