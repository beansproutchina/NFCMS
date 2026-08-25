import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

/**
 * 把主题声明的自定义路由(`theme.config.ts` 里 `pages[].routes`)落成 `dist/ssg-routes.json`。
 *
 * 为什么需要:后端要预渲染 `/about`、`/contact` 这些页面,但它们是**前端主题的内部资产** ——
 * 后端读不到 `theme.config.ts`(那是一个要经过 vite 转译的 TS 模块)。构建期导出一份清单是
 * 唯一不让后端理解前端构建体系的做法。
 *
 * 用正则而不是 import 那个模块:它 import 了 `.vue`、`@` 别名和 vue 运行时,在纯 node 里
 * 加载不了;而这里只需要一个字符串数组。清单错了的症状是「某个自定义页没被预渲染」——
 * 回落 SPA,不会坏站。
 */
export function ssgRoutesPlugin(themeDir = 'src/views/front/templates'): Plugin {
  return {
    name: 'nfcms:ssg-routes',
    apply: 'build',
    closeBundle() {
      const config = path.resolve(themeDir, 'theme.config.ts')
      let routes: string[] = []
      try {
        const src = fs.readFileSync(config, 'utf8')
        // 匹配 `routes: ['/a', "/b"]`,只取字面量。
        for (const m of src.matchAll(/routes\s*:\s*\[([^\]]*)\]/g)) {
          for (const s of m[1].matchAll(/['"]([^'"]+)['"]/g)) routes.push(s[1])
        }
      } catch {
        // 没有主题槽(CI 里单跑构建)就是没有自定义路由,不该让构建失败。
      }
      /**
       * 参数路由(`/en/a/:category_slug`)不是一个能打开的 URL —— 交给预渲染器只会在字面量
       * 路径下产出一张谁也命中不了的死快照。这类页面回落 SPA 是正确行为,不是缺陷。
       */
      routes = [...new Set(routes)].filter((r) => r.startsWith('/') && !r.includes(':'))
      const out = path.resolve('dist/ssg-routes.json')
      fs.mkdirSync(path.dirname(out), { recursive: true })
      fs.writeFileSync(out, JSON.stringify(routes, null, 2))
      console.log(`[ssg-routes] ${routes.length} 条主题自定义路由 → dist/ssg-routes.json`)
    },
  }
}
