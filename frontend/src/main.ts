import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router/index'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import i18n, { primevueLocale } from './i18n'
import { createPinia } from 'pinia'
import { init} from "./views/front/templates/theme.config.ts"

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(i18n)
app.use(PrimeVue, {
    theme: {
        preset: Aura,
        options: {
            darkModeSelector: '.dark'
        }
    },
    locale: primevueLocale
})
app.use(ToastService)
app.use(ConfirmationService)
init(app)

app.mount('#app')
