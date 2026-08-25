import './style.css'
// 只为副作用:在**任何导航开始之前**挂上 `app-error` 监听。见 errorToast.ts。
import './errorToast'
import { createEntryApp } from './entry'
import router from './router/index'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import i18n, { primevueLocale } from './i18n'
import { createPinia } from 'pinia'
import { init} from "./views/front/templates/theme.config.ts"

// 预渲染页走水合、其余走普通挂载。判定见 entry.ts。
const { app, hydrating } = createEntryApp(document.getElementById('app'))
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

/**
 * 水合前必须 `await router.isReady()`。
 *
 * 路由的首次导航是异步的(`beforeResolve` 里要 `fetchContentData`),不等它就挂载,首帧的
 * `<router-view>` 是空的 —— 与预渲染出来的整页必然 mismatch,水合当场退化成全量重渲染,
 * 静态页先绘制出来的内容会闪一下白再回来。
 *
 * 非水合路径(/admin、/login)不必等:那里没有预渲染内容可对齐,早挂载早出框架。
 */
if (hydrating) {
  /**
   * `.catch` 不能省:任何导航守卫抛错都会让 `isReady()` reject,而 reject 之后如果不挂载,
   * 页面就永远停在那份静态 HTML 上 —— 看起来完好,实际一点交互都没有(没有 SPA 接管、
   * 点站内链接整页跳转、登录态永不纠正)。宁可带着一次失败的导航挂上去。
   */
  router.isReady()
    .catch((err) => console.error('[boot] initial navigation failed; mounting anyway so the page is not left inert', err))
    .then(() => app.mount('#app'))
} else {
  app.mount('#app')
}
