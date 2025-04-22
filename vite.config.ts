import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import autoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  base: './',
  plugins: [
    vue(),
    autoImport({
      imports: ['vue'],
      dts: 'src/auto-imports.d.ts',
      vueTemplate: true,
    }),
    tailwindcss(),
  ],
})
