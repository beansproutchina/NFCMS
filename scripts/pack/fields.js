// Deploy-config schema shared by the prompt loop, the --yes path and the env renderers.
// Each entry is one line in a generated env file; `key` is the exact var name compose/backend reads.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const randomSecret = () => crypto.randomBytes(32).toString('hex');

function listThemes(rootDir) {
  const dir = path.join(rootDir, 'frontend_themes');
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

function defaultTheme(rootDir) {
  const themes = listThemes(rootDir);
  return themes.includes('pear') ? 'pear' : themes[0] || 'pear';
}

const port = (v) => (/^\d+$/.test(v) && +v >= 1 && +v <= 65535 ? null : '端口必须是 1-65535 的整数');
const nonEmpty = (label) => (v) => (v.trim() ? null : `${label}不能为空`);
const isMysql = (config) => config.DB_DRIVER === 'mysql';

const GROUPS = {
  instance: '实例与端口(同机多实例靠这几项隔离)',
  site: '站点',
  db: '数据库',
  secret: '密钥(泄露即等于后台被接管;PASSWORD_SALT 变更会作废所有已有密码)',
};

// file: 'compose' → 写进 .env 供 compose 插值(值必须是安全字符集)
//       'app'     → 写进 app.env,经 env_file 原样注入容器
const FIELDS = [
  {
    key: 'NFCMS_CONTAINER_NAME',
    group: 'instance',
    file: 'compose',
    label: '容器名',
    hint: '同一台机器上必须唯一',
    default: (config, ctx) => `nfcms-${ctx.instance}`,
    validate: (v) =>
      /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(v) ? null : '容器名只能用字母数字和 . _ -,且以字母数字开头',
  },
  {
    key: 'NFCMS_IMAGE',
    group: 'instance',
    file: 'compose',
    label: '镜像名:标签',
    default: (config, ctx) => `nfcms-${ctx.instance}:latest`,
    validate: nonEmpty('镜像名'),
  },
  {
    key: 'NFCMS_HTTP_PORT',
    group: 'instance',
    file: 'compose',
    label: 'HTTP 端口(宿主机 → 容器 80)',
    default: () => '54380',
    validate: port,
  },
  {
    key: 'NFCMS_THEME',
    group: 'instance',
    file: 'compose',
    label: '前台主题',
    hint: '构建参数,换主题要重新 up -d --build',
    choices: (config, ctx) => listThemes(ctx.rootDir),
    default: (config, ctx) => defaultTheme(ctx.rootDir),
  },
  {
    key: 'NFCMS_EXTERNAL_NETWORK',
    group: 'instance',
    file: 'compose',
    label: '外部网络名(留空 = 用 compose 默认 bridge)',
    hint: '要连 1Panel/外部 MySQL 才填,如 1panel-network;该网络必须已经存在',
    optional: true,
    default: () => '',
    validate: (v) =>
      !v || /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(v) ? null : '网络名只能用字母数字和 . _ -,且以字母数字开头',
  },
  {
    key: 'SITE_URL',
    group: 'site',
    file: 'app',
    label: '站点对外地址(SSG/sitemap 用)',
    default: () => 'http://localhost',
    validate: nonEmpty('站点地址'),
  },
  {
    key: 'DB_DRIVER',
    file: 'app',
    group: 'db',
    label: '数据库驱动',
    hint: 'sqlite = 容器内文件(挂到 ./data/db);mysql = 外部实例',
    choices: () => ['sqlite', 'mysql'],
    default: () => 'sqlite',
  },
  {
    key: 'MYSQL_HOST',
    file: 'app',
    group: 'db',
    label: 'MySQL 主机',
    hint: '宿主机上的 MySQL 填 host.docker.internal(compose 已映射 host-gateway)',
    when: isMysql,
    default: () => 'host.docker.internal',
    validate: nonEmpty('MySQL 主机'),
  },
  { key: 'MYSQL_PORT', file: 'app', group: 'db', label: 'MySQL 端口', when: isMysql, default: () => '3306', validate: port },
  {
    key: 'MYSQL_USER',
    file: 'app',
    group: 'db',
    label: 'MySQL 用户',
    when: isMysql,
    default: () => 'nfcms',
    validate: nonEmpty('MySQL 用户'),
  },
  {
    key: 'MYSQL_PASSWORD',
    file: 'app',
    group: 'db',
    label: 'MySQL 密码',
    when: isMysql,
    secret: true,
    default: () => '',
    validate: nonEmpty('MySQL 密码'),
  },
  {
    key: 'MYSQL_DATABASE',
    file: 'app',
    group: 'db',
    label: 'MySQL 库名',
    when: isMysql,
    default: () => 'nfcms',
    validate: nonEmpty('库名'),
  },
  {
    key: 'JWT_SECRET',
    file: 'app',
    group: 'secret',
    label: 'JWT 密钥',
    secret: true,
    generate: randomSecret,
  },
  {
    key: 'PASSWORD_SALT',
    file: 'app',
    group: 'secret',
    label: '密码盐 PASSWORD_SALT',
    secret: true,
    generate: randomSecret,
    warnOnChange:
      '改动 PASSWORD_SALT 会让所有已存在用户的密码失效(登录哈希基于它),只有全新部署才该改',
  },
];

module.exports = { FIELDS, GROUPS, listThemes, defaultTheme, randomSecret };
