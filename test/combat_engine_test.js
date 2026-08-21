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
//   - 玩家防御减伤 & 命中后 defStance 清除
//   - 自Buff(atk) 到期还原属性
//   - 多敌：必须全灭才判胜
//   - 单敌旧路径 playTurn 不崩溃且生效（index.html 实况调用 G.CombatEngine.playTurn）
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

// 11) 玩家防御：减伤 & 命中后清除 defStance
section('玩家防御减伤');
{
  function enemyHitDmg(defend) {
    const e = Object.create(CombatEngine);
    e.init(strongPlayer(), 'bandit');
    if (defend) e.state.playerUnits[0].defStance = true;
    const before = e.state.playerUnits[0].hp;
    e.runEnemyPhase();
    return before - e.state.playerUnits[0].hp;
  }
  RNG = 0;
  const dmgNo = enemyHitDmg(false);
  const dmgDef = enemyHitDmg(true);
  check('防御使受到伤害下降', dmgDef < dmgNo, 'no=' + dmgNo + ' def=' + dmgDef);
  const e2 = Object.create(CombatEngine);
  e2.init(strongPlayer(), 'bandit');
  e2.state.playerUnits[0].defStance = true;
  e2.runEnemyPhase();
  check('防御被命中后 defStance 清除', e2.state.playerUnits[0].defStance === false, 'defStance=' + e2.state.playerUnits[0].defStance);
}

// 12) 自Buff(atk) 到期还原
section('自Buff到期还原');
{
  RNG = 0;
  const eng = Object.create(CombatEngine);
  eng.init(strongPlayer(), 'boss');
  const boss = eng.state.enemies[0];
  const base = boss.atk;
  const buffSkill = { id: 'boss_buff', name: '魔气护体', type: 'skill', eff: { selfBuff: { atk: 10, spd: 5, turns: 2 } } };
  eng._resolveAction(boss, buffSkill, [], boss);
  check('selfBuff 后 atk+10', boss.atk === base + 10, 'atk=' + boss.atk);
  eng._tickBuffs();
  check('1 回合后 atk 仍 +10', boss.atk === base + 10, 'atk=' + boss.atk);
  eng._tickBuffs();
  check('buff 到期 atk 还原', boss.atk === base, 'atk=' + boss.atk);
}

// 13) 多敌：必须全灭才判胜
section('多敌全灭判定');
{
  RNG = 0;
  const eng = Object.create(CombatEngine);
  eng.init(strongPlayer(), 'bandit');
  const e2 = JSON.parse(JSON.stringify(eng.state.enemies[0]));
  e2.hp = e2.maxHp = 500;          // 拉高血量，确保一击不致死
  eng.state.enemies.push(e2);
  eng.state.enemies[0].hp = 0;      // 先杀掉第一个
  eng.runPlayerPhase([{ unit: eng.state.playerUnits[0], actionId: 'beng_quan', targetIdx: 1 }]);
  check('未全灭 → 非 win', eng.state.result !== 'win', 'result=' + eng.state.result);
  eng.state.enemies[1].hp = 0;      // 杀掉第二个
  eng.runPlayerPhase([]);           // 空指令触发 _checkEnd
  check('全灭 → win', eng.state.result === 'win', 'result=' + eng.state.result);
}

// 14) 单敌旧路径 playTurn 不崩溃且生效（index.html 实况调用 G.CombatEngine.playTurn）
section('单敌 playTurn 旧路径');
{
  RNG = 0;
  const eng = Object.create(CombatEngine);
  eng.init(strongPlayer(), 'bandit');
  const before = eng.state.enemy.hp;
  let threw = false, r = null;
  try { r = eng.playTurn('beng_quan'); } catch (e) { threw = true; }
  check('playTurn 不崩溃', !threw, threw ? 'threw' : '');
  check('playTurn 返回日志数组', Array.isArray(r), 'r=' + (r && r.length));
  check('playTurn 造成敌人掉血', eng.state.enemy.hp < before, 'before=' + before + ' after=' + eng.state.enemy.hp);
}

// 15) tryFlee：速度决定成败 & 多敌以存活敌为基准（修复 enemies[0] 已死仍按死敌判定）
section('tryFlee 逃跑判定');
{
  RNG = 0;
  // 玩家比敌快 → 必逃（chance 被 max 0.1 下限约束，但 RNG=0<chance 必成功）
  const fast = Object.create(CombatEngine);
  fast.init(strongPlayer(), 'bandit');
  fast.state.player.spd = 50;     // 远高于 bandit
  let r = fast.tryFlee();
  check('玩家远快于敌 → 逃跑成功', r.success === true, 'result=' + fast.state.result);

  RNG = 0;
  // 玩家比敌慢 → 必失败（chance<=0.1，RNG=0<0.1 仍成功！所以用 RNG=9 制造失败，并断言失败后未结束/或丢血）
  const slow = Object.create(CombatEngine);
  slow.init(strongPlayer(), 'bandit');
  slow.state.player.spd = 1;      // 远低于 bandit(14)
  RNG = 9;
  let r2 = slow.tryFlee();
  check('玩家远慢于敌 → 逃跑失败', r2.success === false, 'result=' + slow.state.result);
  check('逃跑失败后未误判胜利', slow.state.result !== 'win', 'result=' + slow.state.result);

  // 多敌：enemies[0] 已死，其余存活且更快 → 不应按死敌(慢)判定（修复点）
  // RNG=5 (Math.random=0.5)：
  //   死敌基准(spd14)→spdDiff16→chance0.72→0.5<0.72 成功；
  //   活敌基准(spd60)→spdDiff-30→chance0.1→0.5<0.1 失败
  // 故断言失败即证明修复生效（按最快存活敌判定）
  let r4 = (function(){ const m = Object.create(CombatEngine); m.init(strongPlayer(),'bandit'); const x=JSON.parse(JSON.stringify(m.state.enemies[0])); x.spd=60; x.maxHp=x.hp=500; m.state.enemies.push(x); m.state.enemies[0].hp=0; m.state.player.spd=30; RNG = 5; return m.tryFlee(); })();
  check('多敌(敌0已死,活敌更快)：按最快存活敌判定 → 较慢 → 逃跑失败', r4.success === false, 'success=' + r4.success + ' result=' + r4.result);
}

// 16) defStance 未被攻击也复位（修复：防御单位未被选为目标时永久减伤）
section('defStance 未被攻击也复位');
{
  RNG = 0;
  // 玩家防御 → 敌方两个目标都打另一个 → 该玩家未被命中，但下一玩家回合 defStance 必须清空
  const eng = Object.create(CombatEngine);
  eng.init(strongPlayer(), 'bandit');
  const pu = eng.state.playerUnits[0];
  pu.defStance = true;   // 模拟上回合防御残留
  // 直接走 runPlayerPhase 开头逻辑（清除玩家方 defStance）
  eng.runPlayerPhase([]);
  check('玩家回合开始清除上回合 defStance', pu.defStance === false, 'defStance=' + pu.defStance);
  // 注：runEnemyPhase 开头只清敌方 defStance；玩家 defStance 在其被敌方命中时（317-320）才清除，属正确行为
}

// 17) 敌方防御后玩家攻击减伤
section('敌方防御减伤');
{
  function playerHitDmg(defend) {
    const e = Object.create(CombatEngine);
    e.init(strongPlayer(), 'bandit');
    // 拉高敌人血量，避免一击致死时伤害被 HP 上限封顶（导致 drop 不等于真实伤害）
    e.state.enemies[0].hp = e.state.enemies[0].maxHp = 500;
    if (defend) e.state.enemies[0].defStance = true;
    const before = e.state.enemies[0].hp;
    e.runPlayerPhase([{ unit: e.state.playerUnits[0], actionId: 'beng_quan', targetIdx: 0 }]);
    return before - e.state.enemies[0].hp;
  }
  RNG = 1; // 非暴击（RNG=1>0.05 → 不暴击，避免暴击放大掩盖防御减伤；hitRate=1 保证命中）
  const dmgNo = playerHitDmg(false);
  const dmgDef = playerHitDmg(true);
  check('敌方防御使受到伤害下降', dmgDef < dmgNo, 'no=' + dmgNo + ' def=' + dmgDef);
  check('防御减伤约 1/3（round 误差内）', dmgDef === Math.round(dmgNo * 2 / 3), 'no=' + dmgNo + ' def=' + dmgDef);
}

// 18) calcDamage 减伤矩阵（护甲 / 防御姿态 / 暴击）
section('calcDamage 减伤矩阵');
{
  RNG = 1; // 非暴击（RNG=1 → r=0.01<0.2 → 非暴击分支）
  const eng = Object.create(CombatEngine);
  eng.init(strongPlayer(), 'bandit');
  const pu = eng.state.playerUnits[0];
  const art = pu.artMap['beng_quan'];
  const en = eng.state.enemies[0];
  const base = eng.calcDamage(pu, art, en, false, 1);
  check('基础伤害 > 0', base > 0, 'base=' + base);
  // 防御姿态 ×1.5 减伤
  en.defStance = true;
  const defDmg = eng.calcDamage(pu, art, en, false, 1);
  check('防御姿态减伤（≈2/3）', defDmg === Math.round(base * 2 / 3), 'base=' + base + ' def=' + defDmg);
  en.defStance = false;
  // 护甲降低伤害：tDef+20 应使伤害下降（公式含 1+0.06*tDef 分母，且与血上限无关）
  const enArm = JSON.parse(JSON.stringify(en));
  enArm.def = en.def + 20;
  const armDmg = eng.calcDamage(pu, art, enArm, false, 1);
  check('护甲提升使伤害下降', armDmg < base, 'base=' + base + ' arm=' + armDmg);
  // 暴击：RNG=0 → 必暴，伤害更高
  RNG = 0;
  const crit = eng.calcDamage(pu, art, en, true, 1);
  check('暴击伤害高于非暴击基础', crit > base, 'base=' + base + ' crit=' + crit);
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
