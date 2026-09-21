// test/syntax_check_all.js
// P0.1 语法快检：对所有 shared/*.js 跑 `node --check`，并对 index.html 内联脚本做 new Function 解析。
// 目的：抓"编辑工具假成功 / 手滑改坏"导致的语法断裂（v20260919j 重构静默断链的第一道防线）。
// 用法： node test/syntax_check_all.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let bad = 0, n = 0;

function check(p) {
  n++;
  try {
    execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' });
  } catch (e) {
    bad++;
    const msg = (e.stderr || e.stdout || '').toString().split('\n').filter(Boolean)[0] || e.message;
    console.log('SYNTAX FAIL ' + path.relative(ROOT, p));
    console.log('  ' + msg);
  }
}

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (e.name === 'vendor') continue; // 第三方 min.js 不查
    const p = path.join(d, e.name);
    for (const f of fs.readdirSync(p, { withFileTypes: true })) {
      const fp = path.join(p, f.name);
      if (f.isDirectory()) walk(fp);
      else if (f.name.endsWith('.js')) check(fp);
    }
  }
}

// shared 顶层 .js + 各子目录
for (const f of fs.readdirSync(path.join(ROOT, 'shared'), { withFileTypes: true })) {
  const fp = path.join(ROOT, 'shared', f.name);
  if (f.isDirectory()) walk(fp);
  else if (f.name.endsWith('.js')) check(fp);
}

// index.html 内联脚本（无 src 的 <script> 块）
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m, i = 0;
while ((m = re.exec(html))) {
  i++;
  const c = m[1];
  if (!c.trim()) continue;
  try { new Function(c); }
  catch (e) { bad++; console.log('INLINE SYNTAX FAIL #' + i + ': ' + e.message); }
}

console.log('已检查 shared/*.js ' + n + ' 个 + index.html 内联 ' + i + ' 段，语法错误=' + bad);
process.exit(bad ? 1 : 0);
