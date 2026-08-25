import { describe, test, expect, beforeEach, vi } from 'vitest'
import { attachErrorSink, __resetErrorSink } from '../src/errorToast'

/**
 * 回归:**挂载之前发生的错误不能被丢掉。**
 *
 * 预渲染页要等 `router.isReady()` 才挂载,而初次导航的全部 prefetch 都在挂载之前跑完。
 * 监听器若注册在 `App.vue` 的 `onMounted` 里,那一整段时间的 `app-error` 全部落空。
 *
 * 实测症状:neo 首页预取了一个「登录可见」栏目 → 匿名 404。**直开首页**静默无提示,
 * **从别的页面路由过来**却弹 "Category Not Found" —— 同一个错误两种表现。
 */
const fire = (detail: string) => window.dispatchEvent(new CustomEvent('app-error', { detail }))

describe('errorToast —— 与挂载时机解耦', () => {
  beforeEach(() => { __resetErrorSink() })

  test('挂载前发生的错误会在接上 sink 后补投', () => {
    fire('Category Not Found')          // 初次导航期间,App.vue 还没挂载
    const sink = vi.fn()
    attachErrorSink(sink)               // App.vue onMounted
    expect(sink).toHaveBeenCalledWith('Category Not Found')
  })

  test('多条挂载前的错误按顺序补投', () => {
    fire('A'); fire('B')
    const sink = vi.fn()
    attachErrorSink(sink)
    expect(sink.mock.calls.map((c) => c[0])).toEqual(['A', 'B'])
  })

  test('挂载后发生的错误直接投递,不进缓冲', () => {
    const sink = vi.fn()
    attachErrorSink(sink)
    fire('later')
    expect(sink).toHaveBeenCalledTimes(1)
    expect(sink).toHaveBeenCalledWith('later')
  })

  test('补投只发生一次(不会在下次 attach 时重复弹)', () => {
    fire('once')
    const first = vi.fn()
    const detach = attachErrorSink(first)
    detach()
    const second = vi.fn()
    attachErrorSink(second)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
  })

  test('断开之后的错误重新进缓冲,而不是丢掉', () => {
    const first = vi.fn()
    attachErrorSink(first)()            // attach 后立刻 detach
    fire('while detached')
    const second = vi.fn()
    attachErrorSink(second)
    expect(second).toHaveBeenCalledWith('while detached')
  })

  test('缓冲有上限,不会无限堆积', () => {
    for (let i = 0; i < 100; i++) fire(`e${i}`)
    const sink = vi.fn()
    attachErrorSink(sink)
    expect(sink.mock.calls.length).toBeLessThanOrEqual(20)
  })
})
