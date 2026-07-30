// 把 DYAPI 框架快照进 vendor/dyapi/,让部署包自带框架源码。
//
// backend/package.json 里 dyapi 是 `file:../../dyapi3/dyapi` —— 仓库外的兄弟目录,docker
// 构建上下文根本看不到它。而 npm 遇到不存在的 file: 路径**不报错**:建一条断链、退出 0,
// 于是镜像构建成功、容器一跑就 `Cannot find module 'dyapi/core/dyapiApp.js'`。
// 所以打包时把它拷进上下文,Dockerfile 再放到 /dyapi3/dyapi(相对 /app/backend 正好是
// ../../dyapi3/dyapi),package.json 一个字都不用改,本地开发照旧用兄弟目录。
const fs = require('fs');
const path = require('path');

const DEST_REL = path.join('vendor', 'dyapi');
const SKIP_DIRS = new Set(['node_modules', '.git', '.DS_Store', 'coverage']);
const SKIP_FILES = /\.(log|db|db-wal|db-shm|tmp)$/;

// 从 backend/package.json 反查,而不是把路径写死在这里
function dyapiSource(rootDir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'backend', 'package.json'), 'utf8'));
  const spec = (pkg.dependencies || {}).dyapi || '';
  if (!spec.startsWith('file:')) return null; // 换成 registry 版本后就不需要 vendor 了
  return path.resolve(rootDir, 'backend', spec.slice('file:'.length));
}

function listFiles(dir, rootDir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, rootDir, out);
    else if (entry.isFile()) out.push(path.relative(rootDir, full));
  }
  return out;
}

function vendorDyapi(rootDir) {
  const src = dyapiSource(rootDir);
  if (!src) return null;
  if (!fs.existsSync(src)) {
    const err = new Error(
      `backend/package.json 的 dyapi 指向 ${src},但该目录不存在 —— 没法把框架打进包里。\n` +
        '  (装不上 dyapi 的包能构建成功但起不来,所以这里直接拦住。)'
    );
    err.expected = true;
    throw err;
  }
  const dest = path.join(rootDir, DEST_REL);
  fs.rmSync(dest, { recursive: true, force: true }); // 全量重拷,避免残留旧文件
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (from) => {
      const name = path.basename(from);
      return !SKIP_DIRS.has(name) && !SKIP_FILES.test(name);
    },
  });
  return { from: src, dir: DEST_REL, files: listFiles(dest, rootDir) };
}

module.exports = { DEST_REL, dyapiSource, vendorDyapi };
