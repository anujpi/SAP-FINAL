import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const api = 'http://localhost:4004'
const page = (name: string) => resolve(import.meta.dirname, `${name}.html`)

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/worker': api, '/manager': api, '/passport': api, '/user': api } },
  build: {
    // The Approuter serves these files on BTP.
    outDir: resolve(import.meta.dirname, '../../.deploy/app-router/resources'),
    emptyOutDir: true,
    rollupOptions: { input: { index: page('index'), check: page('check'), welcome: page('welcome') } }
  }
})
