// Readline helpers for pack.js. Lazily opens stdin so --yes runs never touch it.
// Lines are queued instead of relying on rl.question's one-shot listener, so a piped stdin
// (`printf '...' | node pack.js`) answers the prompts in order instead of silently dropping
// everything after the first line. EOF surfaces as an error rather than an endless re-ask.
const readline = require('readline');

let rl = null;
let closed = false;
const queue = [];
let waiting = null;

function iface() {
  if (rl) return rl;
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('line', (line) => {
    if (waiting) {
      const resolve = waiting;
      waiting = null;
      resolve(line);
    } else {
      queue.push(line);
    }
  });
  rl.on('close', () => {
    closed = true;
    if (waiting) {
      const resolve = waiting;
      waiting = null;
      resolve(null);
    }
  });
  return rl;
}

const EOF_MSG = '输入已结束(stdin EOF):交互模式需要终端;非交互请用 node pack.js -i <实例> -y';

async function ask(question) {
  iface();
  process.stdout.write(question);
  const line = queue.length ? queue.shift() : closed ? null : await new Promise((res) => (waiting = res));
  if (line === null) {
    close();
    const err = new Error(EOF_MSG);
    err.expected = true; // pack.js 只打印 message,不甩堆栈
    throw err;
  }
  if (!process.stdin.isTTY) process.stdout.write(`${line}\n`); // echo piped answers so logs read straight
  return line;
}

async function confirm(question, defaultYes = false) {
  const answer = (await ask(`${question} [${defaultYes ? 'Y/n' : 'y/N'}] `)).trim().toLowerCase();
  if (!answer) return defaultYes;
  return answer === 'y' || answer === 'yes';
}

function close() {
  if (rl) {
    rl.close();
    rl = null;
  }
}

module.exports = { ask, confirm, close };
