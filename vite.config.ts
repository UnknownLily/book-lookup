import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { thwikiBrowserProxy } from './dev/thwikiBrowserProxy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true }), thwikiBrowserProxy()],
  ssr: {
    noExternal: ['vuetify'],
  },
})
