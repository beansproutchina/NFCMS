#!/usr/bin/env node
// NFCMS 部署打包器。
//   node pack.js                 交互式:选/建部署实例 → 逐项确认配置 → 出包
//   node pack.js -i <实例> -y    非交互:直接复用该实例已存的配置出包(CI 用)
//   node pack.js --list          列出本机已有的部署配置
// 产物 NFCMS-<实例>.tar.gz 里带生成好的 .env + app.env,解包后 docker-compose.single.yml 直接读:
// 容器名/端口/数据库/密钥都从它们来,同机多实例互不打架。只针对单容器部署。
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createReadStream, createWriteStream } = require('fs');
const { createGzip } = require('zlib');
const { pipeline } = require('stream/promises');

const { FIELDS } = require('./scripts/pack/fields');
const { renderComposeEnv, renderAppEnv, riskyValues } = require('./scripts/pack/envfile');
const { NETWORK_OVERRIDE_FILE, renderNetworkOverride } = require('./scripts/pack/compose');
const { vendorDyapi } = require('./scripts/pack/vendor');
const { adoptDeployDir } = require('./scripts/pack/adopt');
const { ask, confirm, close } = require('./scripts/pack/prompt');
const profiles = require('./scripts/pack/profile');

const rootDir = path.resolve(__dirname);
const TMP_LIST = '.pack_filelist.tmp';

const USAGE = `NFCMS 打包
  node pack.js [-i <实例名>] [-y] [--out <文件>]
  node pack.js --list
  node pack.js --adopt <已部署目录> [-i <实例名>]

  -i, --instance <名>  部署实例名(决定配置文件 .deploy/<名>.json 与包名)
  -y, --yes            不提问,直接用已存配置 + 默认值
      --out <文件>     指定输出包名(默认 NFCMS-<实例>.tar.gz)
      --list           列出已有部署配置
      --adopt <目录>   从一个已部署目录的 .env + app.env 反向认领配置(密钥丢了/别人打的包时用)
  -h, --help           本帮助`;

function parseArgv(argv) {
  const opts = { instance: null, yes: false, out: null, list: false, help: false, adopt: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-i' || arg === '--instance') opts.instance = argv[++i];
    else if (arg === '-y' || arg === '--yes') opts.yes = true;
    else if (arg === '--out') opts.out = argv[++i];
    else if (arg === '--list') opts.list = true;
    else if (arg === '--adopt') opts.adopt = argv[++i];
    else if (arg === '-h' || arg === '--help') opts.help = true;
    else {
      console.error(`未知参数:${arg}\n\n${USAGE}`);
      process.exit(1);
    }
  }
  return opts;
}

// 只有足够长(密钥类)的值才露头尾用于辨认,短值(密码)整体打码
const mask = (value) => {
  const s = String(value);
  return s.length < 16 ? '*'.repeat(Math.max(s.length, 3)) : `${s.slice(0, 4)}…${s.slice(-4)}`;
};

const projectNameOf = (instance) => instance.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

function summarize(profile) {
  const c = profile.config;
  const db = c.DB_DRIVER === 'mysql' ? `mysql@${c.MYSQL_HOST}:${c.MYSQL_PORT}/${c.MYSQL_DATABASE}` : 'sqlite';
  const when = profile.updatedAt ? profile.updatedAt.slice(0, 10) : '—';
  return `${c.NFCMS_CONTAINER_NAME || '?'}  :${c.NFCMS_HTTP_PORT || '?'}  ${c.NFCMS_THEME || '?'}  ${db}  (${when})`;
}

// ---- 选实例 -----------------------------------------------------------------

async function chooseInstance(existing) {
  if (!existing.length) {
    return askInstanceName('default');
  }
  console.log('已有部署配置:');
  existing.forEach((p, i) => console.log(`  ${i + 1}) ${p.instance.padEnd(16)} ${summarize(p)}`));
  console.log('  n) 新建一个部署实例');
  const answer = (await ask(`选择 [1]: `)).trim() || '1';
  if (answer.toLowerCase() === 'n') return askInstanceName('');
  const idx = Number(answer);
  if (Number.isInteger(idx) && idx >= 1 && idx <= existing.length) return existing[idx - 1].instance;
  console.log('  ! 无效选择');
  return chooseInstance(existing);
}

async function askInstanceName(defaultName) {
  for (;;) {
    const answer = (await ask(`实例名${defaultName ? ` [${defaultName}]` : '(如 school-demo)'}: `)).trim();
    const name = answer || defaultName;
    const err = profiles.validateInstance(name);
    if (err) {
      console.log(`  ! ${err}`);
      continue;
    }
    return name;
  }
}

// ---- 收集配置 ---------------------------------------------------------------

function fallbackValue(field, config, ctx, saved) {
  if (saved[field.key] !== undefined && saved[field.key] !== '') return saved[field.key];
  if (field.generate) return field.generate();
  return field.default ? field.default(config, ctx) : '';
}

function resolveConfig(saved, ctx) {
  const config = {};
  for (const field of FIELDS) {
    if (field.when && !field.when(config)) {
      if (saved[field.key] !== undefined) config[field.key] = saved[field.key]; // 留着,下次切回 mysql 还能用
      continue;
    }
    config[field.key] = fallbackValue(field, config, ctx, saved);
  }
  return config;
}

async function promptSecret(field, saved) {
  const current = saved[field.key];
  if (field.generate) {
    const question = current
      ? `  ${field.label}(回车沿用 ${mask(current)};输入 new 重新生成): `
      : `  ${field.label}(回车自动生成 32 字节随机值): `;
    const answer = (await ask(question)).trim();
    if (!answer) return current || field.generate();
    return answer.toLowerCase() === 'new' ? field.generate() : answer;
  }
  for (;;) {
    const answer = (await ask(`  ${field.label}${current ? `(回车沿用 ${mask(current)})` : ''}: `)).trim();
    const value = answer || current || '';
    const err = field.validate ? field.validate(value) : null;
    if (err) {
      console.log(`    ! ${err}`);
      continue;
    }
    return value;
  }
}

async function promptField(field, config, ctx, saved) {
  if (field.hint) console.log(`  · ${field.hint}`);
  if (field.secret) {
    const value = await promptSecret(field, saved);
    if (field.warnOnChange && saved[field.key] && value !== saved[field.key]) {
      console.log(`  ⚠ ${field.warnOnChange}`);
      if (!(await confirm('  仍然修改?'))) return saved[field.key];
    }
    return value;
  }
  const choices = field.choices ? field.choices(config, ctx) : null;
  const def = saved[field.key] !== undefined && saved[field.key] !== ''
    ? saved[field.key]
    : field.default(config, ctx);
  const label = choices && choices.length ? `${field.label}(${choices.join('/')})` : field.label;
  const shown = def === '' ? '' : ` [${def}]`;
  for (;;) {
    const answer = (await ask(`  ${label}${shown}: `)).trim();
    const value = answer || def;
    if (choices && choices.length && !choices.includes(value)) {
      console.log(`    ! 只能是:${choices.join(' / ')}`);
      continue;
    }
    const err = field.validate ? field.validate(value) : null;
    if (err) {
      console.log(`    ! ${err}`);
      continue;
    }
    return value;
  }
}

async function promptConfig(saved, ctx) {
  const config = {};
  for (const field of FIELDS) {
    if (field.when && !field.when(config)) {
      if (saved[field.key] !== undefined) config[field.key] = saved[field.key];
      continue;
    }
    config[field.key] = await promptField(field, config, ctx, saved);
  }
  return config;
}

// ---- 打包 -------------------------------------------------------------------

function collectFileList(outputFile) {
  let raw;
  try {
    raw = execSync('git ls-files -z --cached --others --exclude-standard', {
      cwd: rootDir,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    console.error('git ls-files 执行失败:确认已安装 git 且当前目录是 git 仓库。');
    process.exit(1);
  }
  const exclude = new Set([outputFile, TMP_LIST]);
  return raw
    .split('\0')
    .map((f) => f.trim())
    .filter(Boolean)
    .filter((f) => !exclude.has(f))
    .filter((f) => fs.existsSync(path.join(rootDir, f))) // 已删除但未 stage 的
    .sort((a, b) => a.localeCompare(b));
}

// tar 的 -C 在同一次调用里对 -T 清单不生效,所以分两步:先按清单打包,再把生成的配置文件
// 追加进去(追加只能对未压缩的 tar 做),最后用 zlib 压缩,免得依赖外部 gzip。
async function buildArchive({ fileList, extraDir, extraFiles, outputFile }) {
  const listFile = path.join(rootDir, TMP_LIST);
  const tarFile = path.join(extraDir, 'NFCMS.tar');
  fs.writeFileSync(listFile, fileList.join('\n'), 'utf8');
  for (const stale of [path.join(rootDir, outputFile), tarFile]) {
    if (fs.existsSync(stale)) fs.unlinkSync(stale);
  }
  try {
    execSync(`tar -cf "${tarFile}" -T "${TMP_LIST}"`, { cwd: rootDir, stdio: 'inherit' });
    execSync(`tar -rf "${tarFile}" -C "${extraDir}" ${extraFiles.join(' ')}`, { cwd: rootDir, stdio: 'inherit' });
    await pipeline(createReadStream(tarFile), createGzip(), createWriteStream(path.join(rootDir, outputFile)));
  } finally {
    fs.unlinkSync(listFile);
    if (fs.existsSync(tarFile)) fs.unlinkSync(tarFile);
  }
}

function printNextSteps({ instance, config, outputFile, profileFile }) {
  const dir = `/opt/${config.NFCMS_CONTAINER_NAME}`;
  const size = (fs.statSync(path.join(rootDir, outputFile)).size / 1024 / 1024).toFixed(1);
  console.log('');
  console.log(`✔ 打包完成 ${outputFile}(${size} MB)`);
  console.log(`  容器 ${config.NFCMS_CONTAINER_NAME} · 端口 ${config.NFCMS_HTTP_PORT} · 主题 ${config.NFCMS_THEME} · 数据库 ${config.DB_DRIVER}`);
  console.log(`  配置已存 ${path.relative(rootDir, profileFile)},下次:node pack.js -i ${instance} -y`);
  console.log('  ⚠ 这份 json 是密钥的唯一本地副本 —— 删了它就再也生成不出同一套 PASSWORD_SALT');
  console.log(`     (真删了也还有救:node pack.js --adopt <服务器上的部署目录> 从 app.env 认领回来)`);
  console.log('');
  console.log('服务器上:');
  console.log(`  mkdir -p ${dir} && tar -xzf ${outputFile} -C ${dir}`);
  console.log(`  cd ${dir}`);
  if (config.NFCMS_EXTERNAL_NETWORK) {
    console.log(`  docker network ls | grep ${config.NFCMS_EXTERNAL_NETWORK}   # 这个外部网络必须先存在`);
  }
  console.log('  docker compose up -d --build      # 别带 -f,.env 的 COMPOSE_FILE 已指定文件');
  const persisted = config.DB_DRIVER === 'mysql' ? '上传文件' : 'sqlite 库 + 上传文件';
  console.log(`  # 需要备份的数据在 ${dir}/data/(${persisted})`);
  if (config.DB_DRIVER === 'mysql') {
    console.log(`  # 库在外部 MySQL(${config.MYSQL_HOST}:${config.MYSQL_PORT}/${config.MYSQL_DATABASE}),备份用 mysqldump`);
  }
  console.log(`  # 首次打开 http://<服务器地址>:${config.NFCMS_HTTP_PORT}/setup 建管理员`);
  console.log(`  # SITE_URL=${config.SITE_URL} 只用于 SSG/sitemap 里的绝对链接`);
  console.log('');
  console.log('⚠ 包内 app.env 含明文密钥,按机密文件传输,别提交到 git。');
}

// ---- 主流程 -----------------------------------------------------------------

async function main() {
  const opts = parseArgv(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return;
  }

  const existing = profiles.listProfiles(rootDir);
  if (opts.list) {
    if (!existing.length) console.log(`还没有部署配置(${profiles.DEPLOY_DIR}/ 为空),跑一次 node pack.js 就会生成。`);
    existing.forEach((p) => console.log(`${p.instance.padEnd(16)} ${summarize(p)}`));
    return;
  }

  if (opts.adopt) {
    const { instance, config, sources, missing } = adoptDeployDir(opts.adopt);
    const name = opts.instance || instance;
    const err = profiles.validateInstance(name);
    if (err) {
      console.error(`! 认不出实例名(${err}),用 -i <名> 明确指定`);
      process.exit(1);
    }
    const file = profiles.writeProfile(rootDir, name, config, new Date().toISOString());
    console.log(`已从 ${sources.join(' + ')} 认领配置 → ${path.relative(rootDir, file)}`);
    console.log(`  实例 ${name} · 容器 ${config.NFCMS_CONTAINER_NAME} · 端口 ${config.NFCMS_HTTP_PORT} · 数据库 ${config.DB_DRIVER}`);
    console.log(`  密钥 JWT_SECRET=${mask(config.JWT_SECRET || '')} PASSWORD_SALT=${mask(config.PASSWORD_SALT || '')}`);
    if (missing.length) console.log(`  ⚠ 这些项没在文件里找到,下次打包会用默认值:${missing.join(', ')}`);
    console.log(`\n接着就能重新出包(密钥沿用,线上密码不受影响):node pack.js -i ${name} -y`);
    return;
  }

  console.log('=== NFCMS 打包 ===');

  let instance = opts.instance;
  if (instance) {
    const err = profiles.validateInstance(instance);
    if (err) {
      console.error(`! ${err}`);
      process.exit(1);
    }
  } else if (opts.yes) {
    instance = existing.length === 1 ? existing[0].instance : 'default';
  } else {
    instance = await chooseInstance(existing);
  }

  const saved = profiles.readProfile(rootDir, instance)?.config || {};
  const ctx = { rootDir, instance };
  if (opts.yes) {
    console.log(`实例 ${instance}:${Object.keys(saved).length ? '复用已存配置' : '全新配置(密钥自动生成)'}`);
  } else {
    console.log(`\n实例 ${instance} —— 逐项确认,回车沿用方括号里的值:`);
  }
  const config = opts.yes ? resolveConfig(saved, ctx) : await promptConfig(saved, ctx);
  close();

  for (const { key, chars } of riskyValues(config)) {
    console.log(`⚠ ${key} 含 ${chars.join(' 和 ')}:各 dotenv 实现对它的处理不一致,强烈建议换掉。`);
    console.log(`  若必须保留,起服务后核对一次:docker exec ${config.NFCMS_CONTAINER_NAME} env | grep ${key}`);
  }

  const generatedAt = new Date().toISOString();
  const profileFile = profiles.writeProfile(rootDir, instance, config, generatedAt);

  const stageDir = profiles.buildDir(rootDir, instance);
  fs.mkdirSync(stageDir, { recursive: true });
  const rendered = {
    '.env': renderComposeEnv({ instance, projectName: projectNameOf(instance), config, generatedAt }),
    'app.env': renderAppEnv({ instance, config, generatedAt }),
  };
  if (config.NFCMS_EXTERNAL_NETWORK) {
    rendered[NETWORK_OVERRIDE_FILE] = renderNetworkOverride({ instance, generatedAt });
  }
  for (const [name, body] of Object.entries(rendered)) {
    fs.writeFileSync(path.join(stageDir, name), body, { encoding: 'utf8', mode: 0o600 });
  }

  const outputFile = opts.out || `NFCMS-${instance}.tar.gz`;
  const tracked = collectFileList(outputFile);
  if (!tracked.length) {
    console.error('没有找到要打包的文件。');
    process.exit(1);
  }
  // dyapi 是仓库外的 file: 依赖,不快照进来的话镜像能构建成功但起不来
  const vendored = vendorDyapi(rootDir);
  if (vendored) {
    console.log(`dyapi 已快照:${vendored.from} → ${vendored.dir}/(${vendored.files.length} 个文件)`);
  }
  const fileList = [...new Set([...tracked, ...(vendored ? vendored.files : [])])].sort((a, b) =>
    a.localeCompare(b)
  );
  const extraFiles = Object.keys(rendered);
  console.log(`\n打包 ${fileList.length} 个文件 + ${extraFiles.join('/')} → ${outputFile} ...`);
  await buildArchive({ fileList, extraDir: stageDir, extraFiles, outputFile });

  printNextSteps({ instance, config, outputFile, profileFile });
}

main().catch((err) => {
  close();
  console.error(err.expected ? `\n! ${err.message}` : err);
  process.exit(1);
});
