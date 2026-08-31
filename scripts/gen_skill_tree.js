#!/usr/bin/env node
/**
 * 技能树 / 武学获得条件表格生成器（数据驱动）
 *
 * 用法：node scripts/gen_skill_tree.js > docs/skill_tree.md
 * 说明：直接读取 shared/data/martial.js 生成 Markdown 表格，
 *       保证与游戏内研习界面（openLearn）的数值完全一致；
 *       后续新增/调整武学，重跑本脚本即可同步文档，无需手写维护。
 * 潜能消耗口径与 index.html 研习界面一致：
 *   武技 = 20 + lineMin*8 + floor(beat/10)（绝技固定 50；技巧 = 20 + lineMin*8）
 */
const fs = require('fs');
const path = require('path');
const MA = require(path.join(__dirname, '..', 'shared', 'data', 'martial.js'));

const LINE_CN = {
  fist: '拳法', sword: '剑法', blade: '刀法', spear: '枪法', staff: '棍法',
  halberd: '戟法', hammer: '锤法', whip: '鞭法', bow: '弓术', hidden: '暗器',
  ride: '骑术', light: '身法', internal: '内功'
};
const TYPE_CN = { skill: '武技', ultimate: '绝技', technique: '技巧' };
const TYPE_ORDER = { skill: 0, ultimate: 1, technique: 2 };

function potCost(a) {
  if (a.type === 'ultimate') return 50;
  if (a.type === 'technique') return 20 + (a.learn ? a.learn.lineMin : 0) * 8;
  return 20 + (a.learn ? a.learn.lineMin : 0) * 8 + Math.floor((a.beat || 0) / 10);
}
function costStr(a) {
  if (!a.cost) return '—';
  if (a.cost.type === 'rage') return '战意 ' + a.cost.val;
  if (a.cost.mp) return '内力 ' + a.cost.mp;
  if (a.cost.energy) return '精力 ' + a.cost.energy;
  return '—';
}
function attrStr(a) {
  if (!a.attr) return '—';
  const wu = a.attr.wu ? '五行·' + a.attr.wu : '';
  const yin = a.attr.yin ? '刚柔·' + a.attr.yin : '';
  return [wu, yin].filter(Boolean).join(' ');
}
function btStr(a) {
  if (!a.breakthrough || !a.breakthrough.length) return '—';
  return a.breakthrough.map(function (b) { return b.realm + '阶:' + b.eff; }).join('<br>');
}
function effStr(a) {
  if (a.type !== 'technique' || !a.eff) return '—';
  if (typeof a.eff === 'string') return a.eff;
  const map = { critRate: '暴击率', critDmg: '暴伤', dodgeRate: '闪避率', atkMul: '攻击', defMul: '防御', spd: '速度', hpMul: '气血', mpMul: '内力' };
  return Object.keys(a.eff).map(function (k) { return (map[k] || k) + '+' + Math.round(a.eff[k] * 100) + '%'; }).join('<br>');
}

// 按艺线分组（仅统计有效武学：有 id 的普通对象，跳过 LINES/REALMS/get* 等辅助成员）
const byLine = {};
let validCount = 0;
Object.keys(MA).forEach(function (k) {
  const a = MA[k];
  if (!a || !a.id || typeof a !== 'object') return;
  validCount++;
  (byLine[a.line] = byLine[a.line] || []).push(a);
});

const out = [];
out.push('# 武学技能树 · 获得条件总表');
out.push('');
out.push('> 本表由 `node scripts/gen_skill_tree.js` 从 `shared/data/martial.js` 自动生成，与游戏内研习界面数值一致。');
out.push('> 共 ' + validCount + ' 门武学（武技 / 绝技 / 技巧），分属 ' + Object.keys(byLine).length + ' 条艺线。');
out.push('> 学习入口：角色面板「研习」→ 按艺线浏览，消耗【潜能】。潜能来源：战斗掉落、历练。');
out.push('');
out.push('## 速览');
out.push('');
out.push('| 艺线 | 武技 | 绝技 | 技巧 | 合计 |');
out.push('|---|---|---|---|---|');
const lineOrder = Object.keys(byLine).sort();
const totalCount = {};
lineOrder.forEach(function (l) {
  const arr = byLine[l];
  const c = { skill: 0, ultimate: 0, technique: 0 };
  arr.forEach(function (a) { c[a.type]++; });
  totalCount.skill = (totalCount.skill || 0) + c.skill;
  totalCount.ultimate = (totalCount.ultimate || 0) + c.ultimate;
  totalCount.technique = (totalCount.technique || 0) + c.technique;
  out.push('| ' + (LINE_CN[l] || l) + ' | ' + c.skill + ' | ' + c.ultimate + ' | ' + c.technique + ' | ' + arr.length + ' |');
});
out.push('| **合计** | **' + totalCount.skill + '** | **' + totalCount.ultimate + '** | **' + totalCount.technique + '** | **' + validCount + '** |');
out.push('');

// 各艺线明细
lineOrder.forEach(function (l) {
  const arr = byLine[l].slice().sort(function (x, y) {
    return (TYPE_ORDER[x.type] - TYPE_ORDER[y.type]) || ((x.learn && x.learn.lineMin) - (y.learn && y.learn.lineMin));
  });
  out.push('## ' + (LINE_CN[l] || l) + '（' + arr.length + ' 门）');
  out.push('');
  out.push('| 武学 | 类型 | 节拍 | 消耗 | 倍率 | 属性 | 艺线门槛 | 耗潜能 | 突破 | 效果 / 描述 |');
  out.push('|---|---|---|---|---|---|---|---|---|---|');
  arr.forEach(function (a) {
    out.push('| **' + a.name + '** | ' + (TYPE_CN[a.type] || a.type)
      + ' | ' + (a.beat || '—')
      + ' | ' + costStr(a)
      + ' | ' + (a.dmgMul ? a.dmgMul + '×' : '—')
      + ' | ' + attrStr(a)
      + ' | ' + (a.learn ? (a.learn.lineMin + ' 级') : '—')
      + ' | ' + potCost(a)
      + ' | ' + btStr(a)
      + ' | ' + (a.type === 'technique' ? effStr(a) : a.desc || '—') + ' |');
  });
  out.push('');
});

fs.writeFileSync(path.join(__dirname, '..', 'docs', 'skill_tree.md'), out.join('\n'), 'utf8');
console.log('已生成 docs/skill_tree.md（' + Object.keys(MA).length + ' 门武学）');
