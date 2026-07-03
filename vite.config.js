import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { execSync } from 'child_process'
import { createVertexHandlers } from './server/handlers/vertex.js'
import { compressVideo, swapAudio, createCloneTxHandler } from './server/handlers/ffmpeg.js'
import { createFetchUrlHandler } from './server/handlers/fetchUrl.js'

// NOTE: the 7 API handlers below now live in server/handlers/*.js so the
// exact same code path runs in dev (Vite middleware, this file) and in
// production (server/index.js, Express). See docs/HANDOFF-Zumia-VPS-Integration.md.

// Capture git commit hash + build date once per Vite process start
function readGitCommit() {
  try { return execSync('git rev-parse --short HEAD', { cwd: __dirname || '.' }).toString().trim() }
  catch { return 'unknown' }
}
const BUILD_COMMIT = readGitCommit()
const BUILD_DATE = new Date().toISOString().slice(0, 10)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const vertex = createVertexHandlers(env)
  const cloneTx = createCloneTxHandler(env)
  const fetchUrl = createFetchUrlHandler(env)

  return {
  plugins: [
    react(),
    tailwindcss(),
    // Vertex AI proxy — signs JWT server-side, auto-refreshes token
    {
      name: 'vertex-proxy',
      configureServer(server) {
        server.middlewares.use('/api/vertex', vertex.vertexProxy)
        server.middlewares.use('/api/vertex-upload', vertex.vertexUpload)
        server.middlewares.use('/api/vertex-status', vertex.vertexStatus)
      }
    },
    // Native ffmpeg compressor — receives raw mp4 body, returns compressed mp4 (audio preserved)
    {
      name: 'video-compressor',
      configureServer(server) {
        server.middlewares.use('/api/compress-video', compressVideo)
      }
    },
    // Audio swap — replaces video's audio track with a new audio file (Clone Voice feature)
    {
      name: 'swap-audio',
      configureServer(server) {
        server.middlewares.use('/api/swap-audio', swapAudio)
      }
    },
    // Clone Transcript pipeline — STT (Vertex Gemini audio), then duration-matched audio assembly
    {
      name: 'clone-transcript',
      configureServer(server) {
        server.middlewares.use('/api/clone-tx', cloneTx)
      }
    },
    // Local proxy to fetch external URLs — bypasses CORS (SSRF-guarded, see server/handlers/fetchUrl.js)
    {
      name: 'fetch-proxy',
      configureServer(server) {
        server.middlewares.use('/api/fetch-url', fetchUrl)
      }
    }
  ],
  server: {
    open: !process.env.DOCKER,
    headers: {
      // Required by ffmpeg.wasm (SharedArrayBuffer)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  define: {
    __BUILD_COMMIT__: JSON.stringify(BUILD_COMMIT),
    __BUILD_DATE__: JSON.stringify(BUILD_DATE),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  }
})
