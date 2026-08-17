// 临时冒烟测试：验证 engine + cards 多敌/卡牌战斗逻辑不抛错
require('./shared/data/enemies.js');
require('./shared/data/items.js');
require('./shared/data/martial.js');
require('./shared/combat/engine.js');
require('./shared/combat/cards.js');

const LF = globalThis.LF;

function mkPlayer(over) {
  return Object.assign({
    name: '测试侠', hp: 1000, maxHp: 1000, mp: 100, maxMp: 30,
    atk: 45, def: 20, spd: 30, element: '金', hitRate: 0.95, critRate: 0.1,
    learnedMartial: ['beng_quan', 'hack_saber', 'iron_cloth', 'poison_needle', 'taiji_push', 'throwing_kun'],
    realm: { beng_quan: 2 },
    equippedForce: ['zhen_skill']
  }, over || {});
}

function run(label, enemyId) {
  console.log('\n=== ' + label + ' ===');
  const eng = LF.CombatEngine;
  const r = eng.init(mkPlayer(), enemyId);
  if (r.error) { console.error('init error', r.error); return; }
  const es = { atk: 45, def: 20, maxHp: 1000, maxMp: 30, spd: 30, hitRate: 0.95, critRate: 0.1, element: '金' };
  const built = LF.CardSystem.buildDeck({ es, artIds: ['beng_quan','hack_saber','iron_cloth','poison_needle','taiji_push'], artMap: eng.state.player.artMap });
  const cs = LF.CardSystem.start(built.handSize, built.deck);
  eng.state.player.mp = eng.state.player.maxMp;
  let turn = 0;
  let ok = true;
  while (!eng.state.result && turn < 60) {
    turn++;
    const intents = eng.peekEnemyIntents();
    LF.CardSystem.drawToFull(cs);
    // 打出所有能打的牌，优先攻击第一存活敌
    let played = true;
    while (played) {
      played = false;
      for (let i = 0; i < cs.hand.length; i++) {
        const c = cs.hand[i];
        if (c.kind === 'flee') continue;   // 测试不主动逃跑
        if (c.cost > eng.state.player.mp) continue;
        let tIdx = 0;
        if (c.target === 'all' || c.target === 'self') tIdx = -1;
        const res = eng.playCard(c, tIdx < 0 ? 0 : tIdx);
        LF.CardSystem.discard(cs, c);
        if (res.ended || eng.state.result) { played = false; break; }
        played = true;
        break;
      }
      if (eng.state.result) break;
    }
    if (eng.state.result) break;
    const er = eng.endTurn();
    if (er.ended || eng.state.result) break;
  }
  const st = eng.getStatus();
  console.log('结果:', eng.state.result, '回合:', turn, '玩家HP:', st.player.hp, '/', st.player.maxHp, '敌存活:', st.enemies.filter(e=>e.hp>0).length);
  console.log('牌组张数:', built.deck.length, '手牌上限:', built.handSize, '抽牌堆剩余:', cs.draw.length, '弃牌堆:', cs.discard.length);
  console.log('掉落:', JSON.stringify(eng.getDrop()));
  return ok;
}

run('单敌 bandit', 'bandit');
run('多敌 [bandit,bandit]', ['bandit','bandit']);
run('Boss 华雄', 'hua_xiong');
run('低属性新手单敌', 'stray_dog');
console.log('\n全部模拟完成，无异常抛出。');
