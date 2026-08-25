#!/usr/bin/env node
/**
 * 开发环境的 SSG 验收入口(spec S15)。
 *
 *   npm run ssg:preview            构建 → 起预览服务器 → 触发全量生成 → 打印地址
 *   npm run ssg:preview -- --no-build     跳过构建(只想重新生成时)
 *
 * 关键点:这个服务器**复刻 nginx 的命中优先级与旁路**,否则本地看到的和生产不是一回事:
 *
 *   1. 真实静态资源(/assets/*.js、/favicon.svg)     → dist/
 *   2. 预渲染页(<path>.html)                         → backend/static/ssg/
 *   3. 其余一切                                       → dist/index.html(SPA 兜底)
 *
 * 外加 `X-SSG-Bypass: 1` 旁路:带这个头的请求**跳过第 2 层**。生成器自己就带着它 ——
 * 否则 chromium 会命中上一轮生成的静态文件,快照的是快照,内容永远停在第一次(spec E1)。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const SSG = path.join(ROOT, '..', 'backend', 'static', 'ssg')
const PORT = Number(process.env.SSG_PREVIEW_PORT) || 4174
const BACKEND = process.env.SSG_BACKEND || 'http://localhost:3000'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
}

const readIfFile = (p) => {
  try { return fs.statSync(p).isFile() ? fs.readFileSync(p) : null } catch { return null }
}
const send = (res, body, file) => {
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' })
  res.end(body)
}

/** /api 与 /static 转发到后端 —— SPA 接管后要能取数,静态页里的上传图片也要能显示。 */
function proxy(req, res) {
  const target = new URL(req.url, BACKEND)
  const upstream = http.request(target, { method: req.method, headers: { ...req.headers, host: target.host } }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers)
    r.pipe(res)
  })
  upstream.on('error', () => { res.writeHead(502); res.end('backend unreachable') })
  req.pipe(upstream)
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const pathname = decodeURIComponent(url.pathname)

  if (pathname.startsWith('/api/') || pathname.startsWith('/static/')) return proxy(req, res)

  // 1. 真实静态资源优先(和 nginx 的 `try_files $uri` 同序)
  const asset = pathname === '/' ? null : readIfFile(path.join(DIST, pathname))
  if (asset) return send(res, asset, pathname)

  // 2. 预渲染页 —— 带旁路头就跳过,让生成器拿到 SPA 而不是自己的旧快照
  if (req.headers['x-ssg-bypass'] !== '1') {
    const rel = pathname === '/' ? 'index.html' : `${pathname.replace(/^\//, '')}.html`
    const page = readIfFile(path.join(SSG, rel))
    if (page) { res.setHeader('X-Served-By', 'ssg'); return send(res, page, rel) }
    if (pathname === '/sitemap.xml') {
      const sm = readIfFile(path.join(SSG, 'sitemap.xml'))
      if (sm) return send(res, sm, 'sitemap.xml')
    }
  }

  // 3. SPA 兜底
  const shell = readIfFile(path.join(DIST, 'index.html'))
  if (!shell) { res.writeHead(500); return res.end('dist/index.html 不存在,先跑一次构建') }
  res.setHeader('X-Served-By', 'spa')
  send(res, shell, 'index.html')
})

const args = process.argv.slice(2)
if (!args.includes('--no-build')) {
  console.log('→ 构建前端')
  const r = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

server.listen(PORT, async () => {
  const base = `http://localhost:${PORT}`
  console.log(`→ 预览服务器 ${base}(静态优先 → SPA 兜底,复刻 nginx 优先级)`)

  // 生成必须由后端做(要读库)。让它对着这个预览服务器渲染。
  console.log('→ 触发全量预渲染')
  try {
    const r = await fetch(`${BACKEND}/api/system/ssg/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(process.env.SSG_COOKIE ? { cookie: process.env.SSG_COOKIE } : {}) },
      body: JSON.stringify({ baseUrl: base }),
    })
    const body = await r.json().catch(() => ({}))
    if (r.status === 401 || r.status === 403) {
      console.error(`✗ 需要 super_admin。把浏览器里的 cookie 传进来:SSG_COOKIE='token=...' npm run ssg:preview -- --no-build`)
    } else if (!r.ok) {
      console.error(`✗ 生成失败(${r.status}):`, body.message ?? '')
    } else {
      console.log(`✓ generated ${body.data?.pages ?? '?'} pages`)
    }
  } catch (e) {
    console.error(`✗ 连不上后端 ${BACKEND} —— 先 cd backend && bun index.ts。`, e.message)
  }
  console.log(`\n打开 ${base} 验收。禁 JS 看到的就是静态产物。Ctrl+C 退出。`)
})
