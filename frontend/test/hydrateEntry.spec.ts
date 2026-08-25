import { describe, test, expect, beforeEach } from 'vitest'
// `src/entry.ts` 把 main.ts 里"该用哪种 app"的判定抽出来 —— main.ts 本身有 mount 副作用，
// 不可导入，判定逻辑留在里面就等于不可测。
import { createEntryApp, isPrerendered } from '../src/entry'

describe('isPrerendered —— 判断这一页是不是预渲染出来的', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-ssg')
    document.body.innerHTML = ''
  })

  test('#app 有子节点且 <html data-ssg> 在场时为真', () => {
    document.documentElement.setAttribute('data-ssg', '')
    document.body.innerHTML = '<div id="app"><div><h1>预渲染的正文</h1></div></div>'
    expect(isPrerendered(document.getElementById('app'))).toBe(true)
  })

  test('#app 为空时为假（/admin、/login 走 SPA 壳）', () => {
    document.body.innerHTML = '<div id="app"></div>'
    expect(isPrerendered(document.getElementById('app'))).toBe(false)
  })

  /**
   * 只看"有没有子节点"不够：一次失败的快照可能落下半棵 DOM，拿它当水合基准会
   * 让 Vue 在一堆 mismatch 上打补丁，比干脆重渲染更慢也更花。`data-ssg` 是生成器
   * 显式盖的章，只认它。
   */
  test('#app 有内容但缺 data-ssg 标记时为假', () => {
    document.body.innerHTML = '<div id="app"><div>来路不明的内容</div></div>'
    expect(isPrerendered(document.getElementById('app'))).toBe(false)
  })

  test('元素不存在时为假，不抛错', () => {
    expect(isPrerendered(null)).toBe(false)
  })
})

describe('createEntryApp —— 预渲染走水合，其余走普通挂载', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-ssg')
    document.body.innerHTML = ''
  })

  test('#app 有预渲染子节点时走 createSSRApp', () => {
    document.documentElement.setAttribute('data-ssg', '')
    document.body.innerHTML = '<div id="app"><div><h1>预渲染的正文</h1></div></div>'
    const { hydrating } = createEntryApp(document.getElementById('app'))
    expect(hydrating).toBe(true)
  })

  test('#app 为空时走 createApp', () => {
    document.body.innerHTML = '<div id="app"></div>'
    const { hydrating } = createEntryApp(document.getElementById('app'))
    expect(hydrating).toBe(false)
  })

  test('两种模式都返回一个可挂载的 app 实例', () => {
    document.body.innerHTML = '<div id="app"></div>'
    const { app } = createEntryApp(document.getElementById('app'))
    expect(typeof app.mount).toBe('function')
    expect(typeof app.use).toBe('function')
  })
})
