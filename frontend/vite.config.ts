import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(async () => {
  const plugins: ReturnType<typeof react>[] = [react()]

  if (process.env.VITE_HTTPS === '1') {
    const { default: basicSsl } = await import('@vitejs/plugin-basic-ssl')
    plugins.push(basicSsl() as ReturnType<typeof react>)
  }

  return {
    plugins,
    base: './',  // Required for Electron file:// loading
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    build: {
      rollupOptions: {
        input: {
          main:    path.resolve(__dirname, 'index.html'),
          overlay: path.resolve(__dirname, 'overlay.html'),
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      // Fix Vite 6 HMR WebSocket in Electron:
      // Vite 6 added token-based WS security; Electron Chromium needs explicit host+protocol
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 5173,
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  }
})
