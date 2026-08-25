/**
 * 应用入口的**判定部分**。
 *
 * 从 main.ts 抽出来是因为 main.ts 有 `app.mount()` 副作用 —— 一 import 就跑,判定逻辑留在
 * 里面等于不可测。
 *
 * 预渲染页走 `createSSRApp` 尝试水合(对得上的子树不重绘),普通页走 `createApp`。
 */
import { createApp, createSSRApp, type App as VueApp } from 'vue'
import App from './App.vue'

/**
 * 这一页是不是预渲染出来的?
 *
 * 只看「#app 有没有子节点」不够:一次失败的快照可能落下半棵 DOM,拿它当水合基准会让 Vue 在一堆
 * mismatch 上打补丁,比干脆重渲染更慢也更花。`data-ssg` 是生成器在清洗阶段显式盖的章
 * (见 backend/app/lib/ssgSanitize.ts),两个条件都满足才算数。
 */
export function isPrerendered(el: Element | null): boolean {
  if (!el || !el.firstElementChild) return false
  return document.documentElement.hasAttribute('data-ssg')
}

/** 按是否预渲染选择挂载方式。`hydrating` 供调用方决定要不要 `await router.isReady()`。 */
export function createEntryApp(el: Element | null): { app: VueApp; hydrating: boolean } {
  const hydrating = isPrerendered(el)
  return { app: hydrating ? createSSRApp(App) : createApp(App), hydrating }
}
