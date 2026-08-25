/**
 * 全局错误提示的**投递口**,与 Vue 应用的挂载时机解耦。
 *
 * 为什么不能直接在 `App.vue` 的 `onMounted` 里 `addEventListener`:
 *
 * 预渲染页要等 `router.isReady()` 才挂载(否则首帧空 DOM 与静态内容对不上,水合退化成整页
 * 重渲染)。而**初次导航的全部 prefetch 都发生在挂载之前** —— 那期间任何一个请求失败,
 * `api.ts` 拦截器 dispatch 出来的 `app-error` 都落在一个空的监听器列表上,被静默丢弃。
 *
 * 实测症状:neo 主题首页预取了 `getCategory('services')`,而该栏目是「登录可见」。
 * **直开首页**没有任何提示,**从别的页面路由过来**却弹 "Category Not Found" —— 同一个错误,
 * 两种表现,取决于当时 app 挂没挂上。
 *
 * 所以监听器在**模块加载时**就注册(早于 `app.use(router)`,也就早于初次导航),
 * 消息先进缓冲区;`App.vue` 挂载后接上真正的 toast,缓冲的消息一次性补投。
 */

/** 挂载前攒下的消息。上限只是防御:正常情况下这里最多几条。 */
const pending: string[] = [];
const MAX_PENDING = 20;

let sink: ((message: string) => void) | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('app-error', (e: any) => {
    const message = String(e?.detail ?? '');
    if (sink) sink(message);
    else if (pending.length < MAX_PENDING) pending.push(message);
  });
}

/**
 * 接上真正的提示实现(App.vue 在 `onMounted` 里调用),并补投挂载前攒下的消息。
 * 返回一个断开函数供 `onUnmounted` 使用。
 */
export function attachErrorSink(fn: (message: string) => void): () => void {
  sink = fn;
  // 补投:splice 出来再投,避免 fn 里又 dispatch 造成重入。
  for (const m of pending.splice(0)) fn(m);
  return () => { if (sink === fn) sink = null; };
}

/** 仅供测试:重置模块状态。 */
export function __resetErrorSink() {
  sink = null;
  pending.length = 0;
}
