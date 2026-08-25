import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

/**
 * 测试配置继承 vite.config,以便共享 `@` 别名与 preserveSymlinks —— 后者是必须的:
 * `src/views/front/templates` 在本地是指向 `frontend_themes/<theme>` 的软链,不保留软链
 * 就会绕过主题槽去 realpath 找 node_modules,裸导入(vue / vue-router)全部解析失败。
 */
export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.spec.ts'],
    // 每个用例都要一份干净的 <html>:就绪信号写在 documentElement 上,跨用例会串。
    restoreMocks: true,
  },
}))
