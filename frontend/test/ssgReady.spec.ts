import { describe, test, expect, beforeEach, vi } from 'vitest'
import { reactive, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

/**
 * 生成器怎么知道页面渲染完了？由应用自报。
 *
 * 不能用 networkidle：neo 主题往 <head> 插了一个指向 fonts.googleapis.com 的 link
 * （theme.config.ts），离线内网里那个请求永远挂着，等网络空闲就是每页必超时。
 * 也不能用固定 sleep：慢页截半张、快页白等，且不可证伪。
 *
 * 所以 DynamicView 渲染完在 <html> 上打 data-ssg-ready，失败打 data-ssg-error，
 * 数据不在场（导航中）时两个都不在。生成器只认这三态。
 */

// 路由 mock：一个可变的 reactive 对象，测试里直接改它来模拟导航。
const routeMock = reactive<any>({
  meta: { viewType: 'article', fetchedData: undefined },
  params: {},
  fullPath: '/a/news/hello',
})

vi.mock('vue-router', () => ({
  useRoute: () => routeMock,
  useRouter: () => ({ push: vi.fn() }),
}))

// api 层整体 mock：DynamicView 只是把它塞进 context 透传给主题，测试里不需要真实现。
vi.mock('../src/api', () => ({
  authAPI: { loginInfo: vi.fn(), login: vi.fn(), logout: vi.fn() },
  crud: vi.fn(),
}))

// 主题槽 mock：避免把真主题（三维背景、字体注入、tokens.css）拖进 happy-dom。
// vi.mock 的工厂会被提升到文件顶部，所以 stub 必须走 vi.hoisted，否则工厂执行时它还没初始化。
const { stub } = vi.hoisted(() => {
  return {
    stub: (name: string) => ({
      name,
      props: ['context'],
      render() { return null },
    }),
  }
})

vi.mock('../src/views/front/templates/DefaultHome.vue', () => ({ default: stub('DefaultHome') }))
vi.mock('../src/views/front/templates/DefaultCategory.vue', () => ({ default: stub('DefaultCategory') }))
vi.mock('../src/views/front/templates/DefaultArticle.vue', () => ({ default: stub('DefaultArticle') }))
vi.mock('../src/views/front/templates/theme.config', () => ({ info: { home: 'DefaultHome' }, pages: {} }))
vi.mock('../src/views/front/AccessGate.vue', () => ({ default: stub('AccessGate') }))

import DynamicView from '../src/views/front/DynamicView.vue'

const okData = (templateName = 'DefaultArticle') => ({
  success: true,
  config: { site_name: '测试站' },
  menus: [],
  data: { article: { title: 'Hello', content: '正文' } },
  meta: {},
  title: 'Hello',
  templateName,
  layouts: [],
})

const html = () => document.documentElement

describe('DynamicView —— SSG 就绪信号', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    html().removeAttribute('data-ssg-ready')
    html().removeAttribute('data-ssg-error')
    routeMock.meta = { viewType: 'article', fetchedData: undefined }
  })

  test('渲染成功后 <html> 带 data-ssg-ready', async () => {
    routeMock.meta.fetchedData = okData()
    mount(DynamicView)
    await flushPromises()
    await nextTick()

    expect(html().hasAttribute('data-ssg-ready')).toBe(true)
    expect(html().hasAttribute('data-ssg-error')).toBe(false)
  })

  /**
   * 生成器见到 error 就**不写文件**。没有这一态的话，一个 404 文章会被渲染成
   * “内容不存在”并落成静态页 —— 之后这篇文章真的发布了，静态站还在说它不存在。
   */
  test('fetchedData.success=false 时打 data-ssg-error，不打 ready', async () => {
    routeMock.meta.fetchedData = { success: false, error: '内容不存在', config: {} }
    mount(DynamicView)
    await flushPromises()
    await nextTick()

    expect(html().hasAttribute('data-ssg-error')).toBe(true)
    expect(html().hasAttribute('data-ssg-ready')).toBe(false)
  })

  /** 数据还没到位（导航中）时两个信号都不该在，否则生成器会抓到半张页面。 */
  test('fetchedData 缺席时既不 ready 也不 error', async () => {
    mount(DynamicView)
    await flushPromises()
    await nextTick()

    expect(html().hasAttribute('data-ssg-ready')).toBe(false)
    expect(html().hasAttribute('data-ssg-error')).toBe(false)
  })

  test('从成功态进入下一次导航时先清掉 ready，落地后重新打上', async () => {
    routeMock.meta.fetchedData = okData()
    mount(DynamicView)
    await flushPromises()
    await nextTick()
    expect(html().hasAttribute('data-ssg-ready')).toBe(true)

    // 导航开始：router 尚未写入新的 fetchedData
    routeMock.meta = { viewType: 'article', fetchedData: undefined }
    await flushPromises()
    await nextTick()
    expect(html().hasAttribute('data-ssg-ready')).toBe(false)

    // 导航落地
    routeMock.meta = { viewType: 'article', fetchedData: okData() }
    await flushPromises()
    await nextTick()
    expect(html().hasAttribute('data-ssg-ready')).toBe(true)
  })

  test('从错误态恢复到成功态时清掉 error', async () => {
    routeMock.meta.fetchedData = { success: false, error: 'boom', config: {} }
    mount(DynamicView)
    await flushPromises()
    await nextTick()
    expect(html().hasAttribute('data-ssg-error')).toBe(true)

    routeMock.meta = { viewType: 'article', fetchedData: okData() }
    await flushPromises()
    await nextTick()
    expect(html().hasAttribute('data-ssg-error')).toBe(false)
    expect(html().hasAttribute('data-ssg-ready')).toBe(true)
  })
})
