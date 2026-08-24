// 生成随包发布的两个配置文件。分成两个是为了绕开插值:
//   .env     —— docker compose 读它做 ${...} 插值(项目名/容器名/镜像/端口/主题)。这些值都被
//               校验成安全字符集,不存在转义问题。
//   app.env  —— 经 compose 的 env_file 直接注入容器的运行时环境变量(密钥/数据库)。用单引号
//               包裹,值一律按字面量处理,密码里带 $ 也不会被当成变量。
const { FIELDS, GROUPS } = require('./fields');
const { composeFiles } = require('./compose');

const BARE = /^[A-Za-z0-9_./:@=+-]*$/;

const isBare = (value) => BARE.test(String(value));

// 单引号 = 字面量(godotenv/compose-go 语义),空格之类都安全
const literal = (value) => (isBare(value) ? String(value) : `'${value}'`);

// dotenv 实现之间对这两个字符的处理不一致(例:Bun 连单引号里的 $VAR 也展开),
// 遇到就明确警告,而不是默默写进文件等着部署时莫名认证失败。
function riskyValues(config) {
  const risky = [];
  // 只看真会写进文件的字段:sqlite 实例里留存的旧 MySQL 密码不该报警
  for (const field of FIELDS.filter((f) => !f.when || f.when(config))) {
    const value = config[field.key];
    if (typeof value !== 'string') continue;
    const chars = ['$', "'"].filter((c) => value.includes(c));
    if (chars.length) risky.push({ key: field.key, chars });
  }
  return risky;
}

function activeFields(config, file) {
  return FIELDS.filter((f) => f.file === file && (!f.when || f.when(config)));
}

function header(instance, generatedAt, purpose) {
  return [
    `# NFCMS 部署配置(${purpose})—— pack.js 为实例「${instance}」生成于 ${generatedAt}`,
    '# 由 docker-compose.single.yml 读取,与它放在同一目录。改完重新 up -d 生效。',
  ];
}

function renderComposeEnv({ instance, projectName, config, generatedAt }) {
  const lines = [
    ...header(instance, generatedAt, '容器形态'),
    '# compose 用它做变量插值:同机多实例靠这几项互不打架。',
    '',
    `COMPOSE_PROJECT_NAME=${literal(projectName)}`,
    '# 加载哪些 compose 文件由这行决定 —— 所以起服务只敲 docker compose up -d --build,别带 -f',
    `COMPOSE_FILE=${literal(composeFiles(config).join(':'))}`,
  ];
  for (const field of activeFields(config, 'compose')) {
    lines.push(`${field.key}=${literal(config[field.key])}`);
  }
  return lines.join('\n') + '\n';
}

function renderAppEnv({ instance, config, generatedAt }) {
  const lines = [
    ...header(instance, generatedAt, '运行时环境变量'),
    '# ⚠ 含明文密钥,勿提交 git、勿公开传输;丢了用同一份 .deploy/<实例>.json 重新打包。',
  ];
  for (const [group, title] of Object.entries(GROUPS)) {
    const fields = activeFields(config, 'app').filter((f) => f.group === group);
    if (!fields.length) continue;
    lines.push('', `# ${title}`);
    for (const field of fields) lines.push(`${field.key}=${literal(config[field.key])}`);
    const skipped = FIELDS.filter(
      (f) => f.file === 'app' && f.group === group && f.when && !f.when(config)
    );
    if (skipped.length) {
      lines.push(`# (DB_DRIVER=${config.DB_DRIVER} — 未使用:${skipped.map((f) => f.key).join(', ')})`);
    }
  }
  return lines.join('\n') + '\n';
}

module.exports = { renderComposeEnv, renderAppEnv, riskyValues };
