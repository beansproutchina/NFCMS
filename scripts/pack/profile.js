// Per-instance deploy profiles: <root>/.deploy/<instance>.json (gitignored, mode 0600).
// One file per deployment target so the next pack can reuse the exact same config.
const fs = require('fs');
const path = require('path');

const DEPLOY_DIR = '.deploy';
const BUILD_DIR = path.join(DEPLOY_DIR, 'build');

const INSTANCE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function validateInstance(name) {
  if (!name) return '实例名不能为空';
  if (!INSTANCE_RE.test(name)) return '实例名只能用字母数字和 . _ -,且以字母数字开头';
  return null;
}

function deployDir(rootDir) {
  return path.join(rootDir, DEPLOY_DIR);
}

function profilePath(rootDir, instance) {
  return path.join(deployDir(rootDir), `${instance}.json`);
}

function buildDir(rootDir, instance) {
  return path.join(rootDir, BUILD_DIR, instance);
}

function readProfile(rootDir, instance) {
  const file = profilePath(rootDir, instance);
  if (!fs.existsSync(file)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { instance, updatedAt: data.updatedAt || null, config: data.config || {}, file };
  } catch (err) {
    console.error(`! 部署配置 ${path.relative(rootDir, file)} 解析失败(${err.message}),忽略。`);
    return null;
  }
}

function listProfiles(rootDir) {
  const dir = deployDir(rootDir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readProfile(rootDir, path.basename(f, '.json')))
    .filter(Boolean)
    .sort((a, b) => a.instance.localeCompare(b.instance));
}

function writeProfile(rootDir, instance, config, updatedAt) {
  const dir = deployDir(rootDir);
  fs.mkdirSync(dir, { recursive: true });
  const file = profilePath(rootDir, instance);
  const body = JSON.stringify({ instance, updatedAt, config }, null, 2) + '\n';
  fs.writeFileSync(file, body, { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(file, 0o600); // existing files keep their old mode without this
  return file;
}

module.exports = {
  DEPLOY_DIR,
  validateInstance,
  deployDir,
  profilePath,
  buildDir,
  readProfile,
  listProfiles,
  writeProfile,
};
