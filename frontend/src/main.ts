import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router/index'
import PrimeVue from 'primevue/config'
import i18n from './i18n'

const app = createApp(App)

app.use(router)
app.use(i18n)
app.use(PrimeVue, { unstyled: true })

app.mount('#app')
