const M = require('./shared/data/martial.js');
const c = {};
for (const k in M) {
  if (M[k] && M[k].line) c[M[k].line] = (c[M[k].line] || 0) + 1;
}
const LINES = M.LINES;
let total = 0;
Object.keys(LINES).forEach(function (l) {
  const n = c[l] || 0;
  total += n;
  console.log(LINES[l].name + '(' + l + ')'.padEnd(2), n);
});
console.log('--- total skills:', total);
const tech = M.getTechniques().map(t => t.name);
console.log('techniques:', tech.join(', '));

// 校验必填字段
let bad = 0;
M.getSkills().concat(M.getUltimates()).concat(M.getTechniques()).forEach(a => {
  ['id','name','line','type','beat','dmgMul','attr','desc','learn'].forEach(f => {
    if (a[f] === undefined) { console.log('MISSING', f, 'in', a.id); bad++; }
  });
  if (LINES[a.line] === undefined) { console.log('BAD LINE', a.line, a.id); bad++; }
});
console.log(bad === 0 ? 'ALL FIELDS OK' : ('FIELD ERRORS: ' + bad));
