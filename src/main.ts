import { ViteSSG } from 'vite-ssg'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { i18n } from './i18n'
import { routes } from './router'
import { vuetify } from './plugins/vuetify'

export const createApp = ViteSSG(
	App,
	{ routes },
	({ app }) => {
		app.use(createPinia())
		app.use(i18n)
		app.use(vuetify)
	},
)
