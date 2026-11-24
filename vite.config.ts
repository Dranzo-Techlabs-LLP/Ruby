import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The portal is served at the root of https://ruby.dranzo.com.
// Port 5190 is the one both admins trust for local testing (src/lib/embed.ts in each admin).
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  server: { host: 'localhost', port: 5190, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
})
