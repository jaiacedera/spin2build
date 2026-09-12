import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import statsHandler from './api/stats.ts'

function siteStatsApi(): Plugin {
  const configure = (server: Pick<ViteDevServer, 'middlewares'>) => {
    server.middlewares.use((request, response, next) => {
      if (request.url?.split('?')[0] === '/api/stats') void statsHandler(request, response)
      else next()
    })
  }
  return { name: 'site-stats-api', configureServer: configure, configurePreviewServer: configure }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'GA_')
  for (const [key, value] of Object.entries(env)) process.env[key] ??= value
  return { plugins: [vue(), siteStatsApi()] }
})
