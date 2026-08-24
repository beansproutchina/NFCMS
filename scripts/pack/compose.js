// 外部网络覆盖片段。compose 没法用插值做"有就加、没有就不加"的条件网络,所以选了外部网络时
// 单独生成这个文件,再靠 .env 里的 COMPOSE_FILE 把它叠到 docker-compose.single.yml 上。
// (network 的 name 可以插值;external 必须是字面量 true,所以条件只能落在"要不要这个文件"上。)
const BASE_COMPOSE_FILE = 'docker-compose.single.yml';
const NETWORK_OVERRIDE_FILE = 'docker-compose.network.yml';

function renderNetworkOverride({ instance, generatedAt }) {
  return [
    `# 由 pack.js 为实例「${instance}」生成于 ${generatedAt} —— 别手改,重新打包会覆盖。`,
    '# 把容器接进一个【已存在】的外部网络(1Panel 面板网络、外部 MySQL 等场景)。',
    '# 网络名在 .env 的 NFCMS_EXTERNAL_NETWORK;本文件由 .env 的 COMPOSE_FILE 自动带上。',
    '# 注意:服务一旦声明网络就不再接默认 bridge —— 这正是要的效果。',
    'services:',
    '  nfcms:',
    '    networks:',
    '      - external_net',
    'networks:',
    '  external_net:',
    '    name: ${NFCMS_EXTERNAL_NETWORK}',
    '    external: true',
    '',
  ].join('\n');
}

// docker compose 读 .env 里的 COMPOSE_FILE 决定加载哪些文件,所以运维永远只敲
// `docker compose up -d --build`(不带 -f)。始终显式写上,避免漏写时被仓库里那份
// 多容器 docker-compose.yml 顶掉。
function composeFiles(config) {
  const files = [BASE_COMPOSE_FILE];
  if (config.NFCMS_EXTERNAL_NETWORK) files.push(NETWORK_OVERRIDE_FILE);
  return files;
}

module.exports = { BASE_COMPOSE_FILE, NETWORK_OVERRIDE_FILE, renderNetworkOverride, composeFiles };
