import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router/index'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import i18n from './i18n'

const app = createApp(App)

app.use(router)
app.use(i18n)
app.use(PrimeVue, {
    theme: {
        preset: Aura,
        options: {
            darkModeSelector: '.dark'
        }
    }
})
app.use(ToastService)

app.mount('#app')
