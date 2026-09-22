// 武将系统单测（v20260921b）：数据注册 / 加成 / 登庸 / 任命 / 克城俘获 / 守将派生
'use strict';
var path = require('path'), ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'shared/data/personas.js'));
require(path.join(ROOT, 'shared/data/officers.js'));
var LF = globalThis.LF;

var fail = 0, pass = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('  ✗ ' + m); } }

// ── 1) 数据注册 ──
var L = LF.PERSONA.listRegistered();
ok(L.length >= 40, '武将注册数量≥40，实=' + L.length);
ok(L.filter(function (o) { return o.faction === '在野'; }).length >= 5, '在野可登庸≥5');
var ids = {}; L.forEach(function (o) { ids[o.id] = (ids[o.id] || 0) + 1; });
ok(Object.keys(ids).every(function (k) { return ids[k] === 1; }), '武将 id 无重复');

// 伪造 ctx
var state = { room: 'luoyang', title: '游侠', gold: 0, flags: { cityPos: { cid: 'luoyang' } }, officers: [] };
var owned = { luoyang: 'player' };
function cityOwnerOf(c) { return owned[c] || 'none'; }
var logLines = [], toastLines = [];
var Officers = require(path.join(ROOT, 'shared/core/officers.js'))({
  getState: function () { return state; }, LF: LF,
  log: function (s) { logLines.push(s); }, toast: function (s) { toastLines.push(s); }, save: function () {},
  escapeHtml: function (s) { return String(s == null ? '' : s); },
  cityOwnerOf: cityOwnerOf, playerFaction: function () { return 'player'; }
});

// ── 2) 默认加成 = 1 ──
ok(Math.abs(Officers.commandBonus() - 1) < 1e-9, '未设主将时 commandBonus=1');
ok(Math.abs(Officers.civilBonus('luoyang') - 1) < 1e-9, '未设太守时 civilBonus=1');

// ── 3) 守将派生 ──
var gc = Officers.garrisonCommander('luoyang');
ok(gc && gc.id === 'lv_bu', '洛阳守将司令为吕布（统率最高），实=' + (gc && gc.id));
var cb = Officers.officerCombat('lv_bu');
ok(cb && cb.atk > 0 && cb.hp > 0, '吕布守将派生数值有效 ' + JSON.stringify(cb));

// ── 4) 寻访在野 ──
var wild = Officers.recruitableHere('luoyang');
ok(wild.length >= 5 && wild[0].faction === '在野', '洛阳可访在野≥5，首=' + (wild[0] && wild[0].name));

// ── 5) 登庸（强制随机=0 必成）──
var realRand = Math.random; Math.random = function () { return 0; };
var r = Officers.recruit('zhuge_liang');
ok(r.ok && state.officers.length === 1, '诸葛亮登庸成功');
Math.random = realRand;
ok(!Officers.recruit('zhuge_liang').ok, '重复登庸被拒');

// ── 6) 任命主将 → commandBonus>1 ──
Officers.appoint('zhuge_liang', 'commander');
ok(Math.abs(Officers.commandBonus() - 1.3) < 1e-9, '诸葛亮任主将→统率60, +30% 战力，实=' + Officers.commandBonus());
// 解主将后恢复
Officers.appoint('zhuge_liang', 'commander'); // 再次任命=解任
ok(Math.abs(Officers.commandBonus() - 1) < 1e-9, '解主将后 commandBonus 回 1');

// ── 7) 任命太守（须己方城）──
ok(Officers.appoint('zhuge_liang', 'governor', 'luoyang'), '诸葛亮守洛阳成功（己方城）');
ok(Math.abs(Officers.civilBonus('luoyang') - 1.552) < 1e-9, '政务92→+55.2% 治域，实=' + (Officers.civilBonus('luoyang') - 1));
ok(!Officers.appoint('zhuge_liang', 'governor', 'xiangyang'), '守敌方城（襄阳）被拒');
ok(Math.abs(Officers.civilBonus('xiangyang') - 1) < 1e-9, '未委任的城 civilBonus=1');

// ── 8) 克城俘获 ──
state.officers = []; Math.random = function () { return 0; };
var cap = Officers.captureFrom('dongzhuo', 'luoyang');   // 洛阳原属董卓
ok(cap.length >= 1, '克洛阳俘获董卓系武将：' + cap.join('、'));
Math.random = realRand;
ok(!Officers.captureFrom('player', 'luoyang').length, '攻己方城不俘获');

// ── 9) 遣散 ──
Math.random = function(){return 0;}; Officers.recruit('guan_yu'); Math.random = realRand; var before = state.officers.length;
Officers.dismiss('guan_yu');
ok(state.officers.length === before - 1, '遣散关羽生效');

// ── 10) 面板渲染（受控 state）──
var ph = Officers.renderOfficerPanel();
ok(ph.indexOf('武 将') >= 0 && ph.indexOf('寻访人才') >= 0, '武将面板含标题与寻访入口');
var sh = Officers.renderSearchPanel();
ok(sh.indexOf('寻访人才') >= 0, '寻访面板可渲染');

console.log('\n武将系统单测：通过 ' + pass + ' / 失败 ' + fail);
process.exit(fail ? 1 : 0);
