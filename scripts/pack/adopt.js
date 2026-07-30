// 从一个**已经部署好的目录**反向认领配置:读它的 .env + app.env,重建 .deploy/<实例>.json。
//
// 存在的理由:密钥只在两个地方 —— `.deploy/<实例>.json` 和部署目录里的 `app.env`。前者丢了
// (删库、换机器、当初是别人打的包)就再也生成不出同一套 PASSWORD_SALT,而换 salt 等于把线上
// 所有用户的密码作废。只要还能拿到服务器上的 app.env,就能把配置认领回来。
const fs = require('fs');
const path = require('path');
const { FIELDS } = require('./fields');

/** dotenv 的最小子集:KEY=VALUE,支持单/双引号包裹,忽略注释与空行。 */
function parseEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let value = t.slice(i + 1).trim();
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function readIfPresent(file) {
  return fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : null;
}

/**
 * @param target 部署目录,或目录里的 app.env / .env 任一文件路径
 * @returns {{ instance:string|null, config:object, sources:string[], missing:string[] }}
 */
function adoptDeployDir(target) {
  const dir = fs.existsSync(target) && fs.statSync(target).isDirectory() ? target : path.dirname(target);
  const composeEnv = readIfPresent(path.join(dir, '.env'));
  const appEnv = readIfPresent(path.join(dir, 'app.env'));
  if (!composeEnv && !appEnv) {
    const err = new Error(`${dir} 里既没有 .env 也没有 app.env —— 这不像一个 NFCMS 部署目录`);
    err.expected = true;
    throw err;
  }
  const merged = { ...(composeEnv || {}), ...(appEnv || {}) };

  const config = {};
  const missing = [];
  for (const field of FIELDS) {
    if (merged[field.key] !== undefined && merged[field.key] !== '') config[field.key] = merged[field.key];
    else if (!field.when && !field.optional) missing.push(field.key);
  }
  // 实例名:容器名去掉 nfcms- 前缀,或退回 compose 项目名
  const fromContainer = (config.NFCMS_CONTAINER_NAME || '').replace(/^nfcms-/, '');
  const instance = fromContainer || merged.COMPOSE_PROJECT_NAME || null;

  const sources = [composeEnv && '.env', appEnv && 'app.env'].filter(Boolean);
  return { instance, config, sources, missing };
}

module.exports = { parseEnv, adoptDeployDir };
