// test/combat_engine_test.js
// ===========================================================================
//  战斗引擎 Node 自测（不依赖浏览器）
//  用法： node test/combat_engine_test.js
//  退出码： 0 = 全部通过，1 = 有失败
//
//  覆盖场景：
//   - 初始化 / 未知敌人报错
//   - calcDamage(单位对象) 不空指针（回归：forceEff 崩溃）
//   - 胜利 win / 失败 lose / 团灭 wipeout / 逃跑 flee(成功&失败)
//   - Boss 斩杀意图（玩家残血→重击） / Boss 狂怒（自身残血→自buff）
//   - 防御意图（AI 选择 defend / 锁定 intent='defend' 实际结算零伤）
//   - DoT 中毒叠加与到期
//   - 多段攻击 multiHit
//   - 回合数计数（每整轮 +1，回归：重复 +1）
// ===========================================================================

// ---- 可控随机数（让结果可复现）----
let RNG = 0;
Math.random = () => RNG;

// ---- 注入 global.LF 数据（引擎 init 时按需读取）----
const ENEMIES = new Map();
const MARTIAL_ARTS = new Map();
global.LF = { ENEMIES: ENEMIES, MARTIAL_ARTS: MARTIAL_ARTS };

// ---- 武学表 ----
function art(o) { MARTIAL_ARTS.set(o.id, o); }
art({ id: 'beng_quan',    name: '崩拳',   type: 'attack', line: 'fist', beat: 30, dmgMul: 1.0, cost: {}, multiHit: 1, attr: { wu: '金' }, desc: '基础崩拳' });
art({ id: 'lian_huan_tui',name: '连环腿', type: 'attack', line: 'leg',  beat: 40, dmgMul: 0.7, cost: {}, multiHit: 2, attr: { wu: '木' }, desc: '两段攻击' });
art({ id: 'poison_palm',  name: '毒砂掌', type: 'attack', line: 'palm', beat: 35, dmgMul: 0.9, cost: {}, multiHit: 1, attr: { wu: '火' }, desc: '带毒', eff: { poisonChance: 1, poisonDmg: 10, poisonTurns: 3 } });
art({ id: 'heavy_strike', name: '开山掌', type: 'attack', line: 'palm', beat: 70, dmgMul: 1.8, cost: {}, multiHit: 1, attr: { wu: '土' }, desc: '重击' });

// ---- 敌人表 ----
function enemy(o) { ENEMIES.set(o.id, o); }
enemy({ id: 'dummy',  name: '木人',   hp: 30,  atk: 5,  def: 2, spd: 5,  ai: 'aggressive', skills: [] });
enemy({ id: 'bandit', name: '山贼',   hp: 50,  atk: 12, def: 4, spd: 12, ai: 'aggressive',
  skills: [{ id: 'slash', name: '劈砍', type: 'attack', line: 'blade', beat: 30, dmgMul: 1.0, cost: {}, multiHit: 1, attr: { wu: '金' }, desc: '劈砍' }] });
enemy({ id: 'brute',  name: '巨力莽汉', hp: 500, atk: 40, def: 5, spd: 8, ai: 'aggressive',
  skills: [{ id: 'smash', name: '重砸', type: 'attack', line: 'fist', beat: 30, dmgMul: 1.0, cost: {}, multiHit: 1, attr: { wu: '金' }, desc: '重砸' }] });
enemy({ id: 'coward', name: '胆怯贼', hp: 60,  atk: 10, def: 4, spd: 10, ai: 'conservative',
  skills: [{ id: 'slash2', name: '挥砍', type: 'attack', line: 'blade', beat: 30, dmgMul: 1.0, cost: {}, multiHit: 1, attr: { wu: '金' }, desc: '挥砍' }] });
enemy({ id: 'boss',   name: '魔头',   hp: 300, atk: 28, def: 10, spd: 18, ai: 'boss', element: '土',
  skills: [
    { id: 'claw',         name: '魔爪',   type: 'attack', line: 'fist',  beat: 30, dmgMul: 1.0, cost: {}, multiHit: 1, attr: { wu: '土' }, desc: '魔爪' },
    { id: 'heavy_strike', name: '开山掌', type: 'attack', line: 'palm',  beat: 70, dmgMul: 1.8, cost: {}, multiHit: 1, attr: { wu: '土' }, desc: '重击' },
    { id: 'boss_buff',    name: '魔气护体', type: 'skill', line: 'aura', beat: 40, dmgMul: 0,   cost: {}, eff: { selfBuff: { atk: 10, spd: 5, turns: 2 } }, desc: '自我增益' }
  ] });

// ---- 玩家模板 ----
function strongPlayer() {
  return { name: '测试侠', hp: 120, maxHp: 120, mp: 30, maxMp: 30, atk: 35, def: 12, spd: 30,
    element: '金', hitRate: 1, critRate: 0, equippedForce: [],
    learnedMartial: ['beng_quan', 'lian_huan_tui', 'poison_palm', 'heavy_strike'] };
}
function weakPlayer() {
  return { name: '弱侠', hp: 25, maxHp: 25, mp: 20, maxMp: 20, atk: 15, def: 3, spd: 20,
    element: '无', hitRate: 1, critRate: 0, equippedForce: [], learnedMartial: ['beng_quan'] };
}

// ---- 载入引擎 ----
const CombatEngine = require('../shared/combat/engine.js');

// ---- 测试框架 ----
const results = [];
function check(name, pass, detail) { results.push({ name, pass: !!pass, detail: detail || '' }); }
function section(t) { console.log('\n--- ' + t + ' ---'); }

// 通用：跑完整一场（玩家默认用 beng_quan 打首个存活敌），返回完成的整轮数
function runCombat(engine, maxRounds) {
  engine.peekEnemyIntents();
  let rounds = 0;
  while (!engine.state.result && rounds < maxRounds) {
    const orders = engine.state.playerUnits.filter(u => u.hp > 0).map(u => ({
      unit: u,
      actionId: (u.artMap && u.artMap['beng_quan']) ? 'beng_quan' : 'defend',
      targetIdx: firstLivingEnemyIdx(engine)
    }));
    engine.runPlayerPhase(orders);
    if (engine.state.result) break;
    engine.runEnemyPhase();
    rounds++;
  }
  return rounds;
}
function firstLivingEnemyIdx(engine) {
  for (let i = 0; i < engine.state.enemies.length; i++) if (engine.state.enemies[i].hp > 0) return i;
  return 0;
}

// ============================ 测试开始 ============================

// 0) 初始化 & 未知敌人
section('初始化');
{
  const e0 = CombatEngine.init(strongPlayer(), 'dummy');
  check('init 成功返回 ok', e0 && e0.ok === true, JSON.stringify(e0));
  const eErr = CombatEngine.init(strongPlayer(), 'no_such_enemy');
  check('未知敌人返回 error', eErr && eErr.error, JSON.stringify(eErr));
}

// 1) calcDamage 以单位对象为 actor（回归：forceEff 崩溃）
section('calcDamage(单位对象)');
{
  CombatEngine.init(strongPlayer(), 'bandit');
  const pu = CombatEngine.state.playerUnits[0];
  const en = CombatEngine.state.enemies[0];
  const dmgObj = CombatEngine.calcDamage(pu, pu.artMap['beng_quan'], en, false, 1);
  check('actor=单位对象 返回正数伤害', dmgObj > 0, 'dmg=' + dmgObj);
  const dmgStr = CombatEngine.calcDamage('player', pu.artMap['beng_quan'], en, false, 1);
  check('actor="player" 字符串兼容', dmgStr > 0, 'dmg=' + dmgStr);
  const dmgBad = CombatEngine.calcDamage('ghost', pu.artMap['beng_quan'], en, false, 1);
  check('无效 actor 返回 0（不崩溃）', dmgBad === 0, 'dmg=' + dmgBad);
}

// 2) 胜利
section('胜利 win');
{
  RNG = 0;
  const eng = Object.create(CombatEngine);
  eng.init(strongPlayer(), 'dummy');
  const r = runCombat(eng, 20);
  check('结果 = win', eng.state.result === 'win', 'result=' + eng.state.result);
  check('敌全灭', eng.state.enemies.every(e => e.hp <= 0));
}

// 3) 失败
section('失败 lose');
{
  RNG = 0;
  const eng = Object.create(CombatEngine);
  eng.init(weakPlayer(), 'bandit');
  runCombat(eng, 20);
  check('结果 = lose', eng.state.result === 'lose', 'result=' + eng.state.result);
  check('玩家阵亡', eng.state.playerUnits.every(u => u.hp <= 0));
}

// 4) 团灭（多玩家全死）
section('团灭 wipeout');
{
  RNG = 0;
  const eng = Object.create(CombatEngine);
  eng.init([weakPlayer(), weakPlayer()], 'brute');
  runCombat(eng, 30);
  check('结果 = lose', eng.state.result === 'lose', 'result=' + eng.state.result);
  check('全部玩家单位阵亡', eng.state.playerUnits.every(u => u.hp <= 0));
}

// 5) 逃跑成功 & 失败
section('逃跑 flee');
{
  RNG = 0; // 成功
  const engS = Object.create(CombatEngine);
  engS.init(strongPlayer(), 'bandit');
  const fr = engS.tryFlee();
  check('逃跑成功 → result=fled', fr.success === true && engS.state.result === 'fled', JSON.stringify(fr));

  RNG = 0.99; // 失败路径
  const engF = Object.create(CombatEngine);
  engF.init(strongPlayer(), 'bandit');
  const ff = engF.tryFlee();
  check('逃跑失败返回 success=false（且不崩溃）', ff.success === false, JSON.stringify(ff));
  RNG = 0;
}

// 6) Boss 斩杀意图 & 狂怒
section('Boss 意图');
{
  RNG = 0;
  const eng = Object.create(CombatEngine);
  eng.init(strongPlayer(), 'boss');
  // 玩家残血（hpR<0.3），Boss 满血（跳过狂怒分支）→ 应取重击(dmgMul>=1.5)
  eng.state.playerUnits.forEach(u => { u.hp = 10; });
  eng.state.enemies[0].hp = eng.state.enemies[0].maxHp;
  const execAct = eng._pickEnemyAction(eng.state.enemies[0]);
  check('玩家残血 → Boss 选重击(dmgMul>=1.5)', execAct && (execAct.dmgMul || 0) >= 1.5, JSON.stringify(execAct && execAct.name));

  // Boss 残血（hpR<0.4）→ 应取自buff
  const eng2 = Object.create(CombatEngine);
  eng2.init(strongPlayer(), 'boss');
  eng2.state.enemies[0].hp = 50; // 300 的 0.167
  const rageAct = eng2._pickEnemyAction(eng2.state.enemies[0]);
  check('Boss 残血 → 选自我增益', rageAct && rageAct.eff && rageAct.eff.selfBuff, JSON.stringify(rageAct && rageAct.name));
}

// 7) 防御意图
section('防御意图 defend');
{
  RNG = 0;
  // 7a) 保守 AI 残血且无治疗 → 选 defend
  const engA = Object.create(CombatEngine);
  engA.init(strongPlayer(), 'coward');
  engA.state.enemies[0].hp = 10; // hpR<0.3
  const defAct = engA._pickEnemyAction(engA.state.enemies[0]);
  check('保守敌残血无治疗 → 意图=defend', defAct === 'defend', JSON.stringify(defAct));

  // 7b) 锁定 intent='defend' → 实际结算零伤
  const engB = Object.create(CombatEngine);
  engB.init(strongPlayer(), 'bandit');
  engB.state.enemies[0].intent = 'defend';
  const beforeHp = engB.state.playerUnits[0].hp;
  engB.runEnemyPhase();
  check('敌防御 → 玩家血量不变', engB.state.playerUnits[0].hp === beforeHp, 'before=' + beforeHp + ' after=' + engB.state.playerUnits[0].hp);
}

// 8) DoT 中毒：叠加 / 到期 / 整轮结算
section('DoT 中毒');
{
  RNG = 0;
  const eng = Object.create(CombatEngine);
  eng.init(strongPlayer(), 'bandit');
  const en = eng.state.enemies[0];
  const baseHp = en.hp;
  eng._addDot(en, '中毒', 10, 3);
  const log = [];
  eng._tickDots(log);
  check('中毒第1跳 -10', en.hp === baseHp - 10, 'hp=' + en.hp);
  check('中毒剩余回合=2', en.dots[0].turns === 2, 'turns=' + (en.dots[0] && en.dots[0].turns));
  eng._tickDots([]); eng._tickDots([]);
  check('中毒3跳后消失', en.dots.length === 0, 'dots=' + en.dots.length);

  // 叠层：两次同名 → stacks=2 → 每跳 20
  const en2 = eng.state.enemies[0];
  const h2 = en2.hp;
  eng._addDot(en2, '中毒', 10, 3);
  eng._addDot(en2, '中毒', 10, 3);
  eng._tickDots([]);
  check('叠层中毒每跳 -20', en2.hp === h2 - 20, 'hp=' + en2.hp + ' stacks=' + en2.dots[0].stacks);

  // 整轮结算：runPlayerPhase 开头 tick DoT
  const eng3 = Object.create(CombatEngine);
  eng3.init(strongPlayer(), 'bandit');
  const en3 = eng3.state.enemies[0];
  const h3 = en3.hp;
  eng3._addDot(en3, '中毒', 10, 3);
  eng3.runPlayerPhase([]); // 空指令，仅 DoT
  check('runPlayerPhase 开头结算 DoT', en3.hp === h3 - 10, 'hp=' + en3.hp);
}

// 9) 多段攻击 multiHit
section('多段攻击 multiHit');
{
  RNG = 0;
  const eng = Object.create(CombatEngine);
  eng.init(strongPlayer(), 'bandit');
  const pu = eng.state.playerUnits[0];
  const en = eng.state.enemies[0];
  const artObj = pu.artMap['lian_huan_tui']; // multiHit=2
  const before = 1000;
  en.hp = before; if (en.maxHp < before) en.maxHp = before; // 防止溢出，保证可精确校验
  const dmgFirst = eng.calcDamage(pu, artObj, en, true, 1); // 仅首击伤害，用于比较
  const log = [];
  eng._resolveAction(pu, artObj, log, en);
  const dealt = before - en.hp;
  const m = log[0].text && log[0].text.match(/造成 (\d+) 伤害/);
  const logTotal = m ? parseInt(m[1], 10) : -1;
  check('multiHit=2 实际总伤 = 日志总伤', dealt === logTotal, 'dealt=' + dealt + ' logTotal=' + logTotal);
  check('multiHit=2 总伤大于单段首击', dealt > dmgFirst, 'dealt=' + dealt + ' first=' + dmgFirst);
  check('日志含多段描述(首击/追击)',
    log.some(l => /首击/.test(l.text || '')) && log.some(l => /追击/.test(l.text || '')),
    JSON.stringify(log.map(l => l.text)));
}

// 10) 回合数计数（每整轮 +1，不重复）
section('回合计数');
{
  RNG = 0;
  const eng = Object.create(CombatEngine);
  eng.init(strongPlayer(), 'dummy'); // dummy 只会防御，不会打死人，可长时间对局
  eng.peekEnemyIntents();
  const startRound = eng.state.round; // 应为 1
  for (let i = 0; i < 3; i++) {
    eng.runPlayerPhase([]); // 空指令：仅 DoT（此处无），不推进回合
    if (eng.state.result) break;
    eng.runEnemyPhase();    // 整轮结束，回合 +1
  }
  check('起始回合=1', startRound === 1, 'round=' + startRound);
  check('3 个整轮后回合=4（每轮+1，无重复+1）', eng.state.round === 4, 'round=' + eng.state.round);
}

// ============================ 汇总 ============================
console.log('\n==== 战斗引擎自测结果 ====');
let fail = 0;
results.forEach(r => {
  const tag = r.pass ? 'PASS' : 'FAIL';
  if (!r.pass) fail++;
  console.log(`[${tag}] ${r.name}${r.detail ? '  (' + r.detail + ')' : ''}`);
});
console.log(`\n${results.length - fail}/${results.length} 通过`);
process.exit(fail ? 1 : 0);
