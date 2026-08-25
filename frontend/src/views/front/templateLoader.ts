/**
 * 主题模板的解析(名字 → 组件)。**从 DynamicView 抽出来是为了让它能在导航完成之前跑完。**
 *
 * 为什么要这样:DynamicView 原先在 `watch` 里异步 `import()` 模板,于是组件挂载后的**第一次
 * 同步渲染** `templateComponent` 还是 `null`,DOM 是空的 `<div><!----></div>`。
 * 普通 SPA 下这只是一帧空白,没人注意;但预渲染页要在这一帧上**水合**——空 DOM 对不上整页
 * 静态内容,Vue 判定 mismatch 后整棵重渲染,于是出现 8876 → 18 → 8876 的整页闪白,
 * 水合的收益也全部作废。
 *
 * 现在由 router 在 `beforeResolve` 里连同数据一起解析好,DynamicView 首帧即可同步渲染。
 */
import { markRaw } from 'vue'
import DefaultHome from './templates/DefaultHome.vue'
import DefaultCategory from './templates/DefaultCategory.vue'
import DefaultArticle from './templates/DefaultArticle.vue'
// 框架兜底的 gate 页。刻意放在 templates/ 之外 —— 那个目录会被主题整体覆盖(Dockerfile.single)。
import BuiltinAccessGate from './AccessGate.vue'
import { info as themeInfo } from './templates/theme.config'

/** 主题目录下的全部模板。glob 必须是字面量,所以只能有这一处。 */
const modules = import.meta.glob('./templates/*.vue')

/** 各 viewType 的默认模板(主题没提供同名文件时的兜底)。 */
const DEFAULTS: Record<string, any> = {
  home: DefaultHome,
  category: DefaultCategory,
  article: DefaultArticle,
}

/** 受众轴 gate 页的模板名。主题可用 `info.accessGate` 换名。 */
export const accessGateName = () => (themeInfo as any)?.accessGate || 'AccessGate'

/** 按名字取主题模板;主题没有该文件时用 `fallback`。 */
export async function loadTemplate(name: string, fallback?: any): Promise<any> {
  const path = `./templates/${name}.vue`
  if (modules[path]) {
    try {
      const mod: any = await modules[path]()
      return markRaw(mod.default)
    } catch (e) {
      console.error(`[theme] failed to load template "${name}"`, e)
    }
  } else if (!fallback) {
    console.warn(`[theme] template "${name}" not found and no fallback given`)
  }
  return fallback ? markRaw(fallback) : null
}

/**
 * 解析一个页面需要的全部组件:页面模板 + 它的 layout 链。
 *
 * gate 页有专属兜底 —— 回落到 DefaultArticle 会渲染一个没有正文的空文章页,而这里需要的
 * 是登录引导。主题在自己目录里放 `AccessGate.vue` 即可覆盖。
 */
export async function resolveTemplateChain(
  templateName: string,
  layouts: string[],
  viewType: string,
): Promise<{ template: any; layouts: any[] }> {
  const fallback = templateName === accessGateName()
    ? BuiltinAccessGate
    : (DEFAULTS[viewType] || DefaultHome)

  const [template, resolvedLayouts] = await Promise.all([
    loadTemplate(templateName, fallback),
    Promise.all(layouts.map((l) => loadTemplate(l))),
  ])
  return { template, layouts: resolvedLayouts.filter(Boolean) }
}
