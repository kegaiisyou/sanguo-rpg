// test/index_html_syntax_check.js
// 校验 index.html 内联脚本的语法（不执行，仅 new Function 解析），
// 防止净化/改动（如删除卡牌战斗死代码）时引入语法错误。
// 用法： node test/index_html_syntax_check.js
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m, i = 0, errs = 0;
while ((m = re.exec(html))) {
  i++;
  const code = m[1];
  if (!code.trim()) continue;
  try { new Function(code); }
  catch (e) { errs++; console.log('内联脚本 #' + i + ' 语法错误: ' + e.message); }
}
console.log('已检查 ' + i + ' 个内联脚本，错误数=' + errs);
process.exit(errs ? 1 : 0);
