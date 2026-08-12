(function(global) {
  'use strict';

  // ========== 卡牌层（卡牌战斗纯逻辑）==========
  // 复用 CombatEngine 的伤害公式 / 五行 / 状态Buff / 掉落 / 敌人AI。
  // 本层只负责：牌组构建、抽弃牌循环、按 effectiveStats 缩放强度/数量。
  // 「武学→不同牌组」分化（archetype）预留接口，首版仅通用缩放。

  var CARD_TEMPLATES = {
    attack: { kind:'attack', cost:1, target:'enemy', name:'普通攻击', desc:'对单体造成基于攻击的伤害', color:'attack' },
    charge: { kind:'charge', cost:1, target:'self',  name:'蓄力',     desc:'凝神蓄力，下一张攻击/技能伤害提升', color:'charge' },
    defend: { kind:'defend', cost:1, target:'self',  name:'防御',     desc:'摆出防御架势，大幅减伤并回内力', color:'defend' },
    dodge:  { kind:'dodge',  cost:1, target:'self',  name:'闪避',     desc:'身形虚晃，规避本回合所有敌方攻击', color:'dodge' },
    flee:   { kind:'flee',   cost:0, target:'self',  name:'逃跑',     desc:'尝试脱离战斗（失败则被敌方追击）', color:'flee' },
    skill:  { kind:'skill',  cost:2, target:'enemy', name:'武学',     desc:'施展已学武学，伤害随属性缩放', color:'attack' }
  };

  var _uid = 1;
  function nextUid() { return _uid++; }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function mk(kind, over) {
    var tpl = CARD_TEMPLATES[kind];
    var c = {
      uid: nextUid(),
      kind: tpl.kind,
      cost: tpl.cost,
      target: tpl.target,
      name: tpl.name,
      desc: tpl.desc,
      color: tpl.color
    };
    if (over) { for (var k in over) c[k] = over[k]; }
    return c;
  }

  var CardSystem = {

    // 构建牌组
    // ctx: { es:{atk,def,maxHp,maxMp,spd,hitRate,critRate,element}, artIds:[], artMap:{}, archetype:'generic' }
    buildDeck: function(ctx) {
      var es = ctx.es || {};
      var deck = [];
      var MARTIAL_ARTS = global.LF.MARTIAL_ARTS;

      // 普通攻击：数量随攻击属性提升（属性越强，进攻牌越多）
      var nAtk = 4 + Math.floor((es.atk || 15) / 18);
      nAtk = Math.max(3, Math.min(8, nAtk));
      var hasHeavy = (es.atk || 0) >= 40; // 高攻者持有一张「重击」
      for (var i = 0; i < nAtk; i++) {
        var isHeavy = hasHeavy && i === 0;
        deck.push(mk('attack', {
          dmgMul: isHeavy ? 1.6 : 1.0,
          name: isHeavy ? '重击' : '普通攻击'
        }));
      }

      // 蓄力 ×2（倍率随暴击率略升）
      var chargeMul = 1.5 + Math.min(0.5, (es.critRate || 0));
      deck.push(mk('charge', { chargeMul: chargeMul }));
      deck.push(mk('charge', { chargeMul: chargeMul * 0.9 }));

      // 防御 ×3
      deck.push(mk('defend'));
      deck.push(mk('defend'));
      deck.push(mk('defend'));

      // 闪避 ×2
      deck.push(mk('dodge'));
      deck.push(mk('dodge'));

      // 逃跑 ×1
      deck.push(mk('flee'));

      // 技能：每个已学「攻击型/自增益型」武学生成卡（强度随武学本身 dmgMul 与境界缩放）
      var artIds = ctx.artIds || [];
      var seen = {};
      artIds.forEach(function(aid) {
        if (seen[aid]) return; seen[aid] = true;
        var art = (ctx.artMap && ctx.artMap[aid]) || (MARTIAL_ARTS && MARTIAL_ARTS.get(aid));
        if (!art) return;
        if (art.type === 'technique') return; // 心法不进牌组
        var isAoe = !!(art.eff && art.eff.aoe);
        var copies = art.type === 'selfbuff' ? 1
          : (art.dmgMul >= 1.5 ? 1 : 2);
        for (var k = 0; k < copies; k++) {
          deck.push(mk('skill', {
            name: art.name,
            cost: Math.max(1, Math.round((art.cost && art.cost.val) || (art.dmgMul >= 1.4 ? 2 : 1))),
            target: (art.eff && art.eff.selfBuff) ? 'self' : (isAoe ? 'all' : 'enemy'),
            aoe: isAoe,
            color: (art.eff && art.eff.selfBuff) ? 'defend' : 'attack',
            dmgMul: art.dmgMul,
            multiHit: art.multiHit || 1,
            attr: art.attr || null,
            eff: art.eff || {},
            action: Object.assign({}, art)
          }));
        }
      });

      // 手牌上限随速度提升（spd 越快，每回合能调动的牌越多）
      var handSize = Math.min(8, 5 + Math.floor((es.spd || 20) / 25));

      return { deck: deck, handSize: handSize };
    },

    // 开局：洗牌，构建抽牌堆，初始手牌为空（由 drawToFull 抽满）
    start: function(handSize, deck) {
      var draw = shuffle(deck.slice());
      return { draw: draw, hand: [], discard: [], handSize: handSize };
    },

    // 抽一张（抽牌堆空则洗弃牌堆回抽牌堆）
    draw: function(state) {
      if (state.draw.length === 0) {
        if (state.discard.length === 0) return null;
        state.draw = shuffle(state.discard);
        state.discard = [];
      }
      return state.draw.pop();
    },

    // 抽满手牌至 handSize
    drawToFull: function(state) {
      while (state.hand.length < state.handSize) {
        var c = this.draw(state);
        if (!c) break;
        state.hand.push(c);
      }
      return state;
    },

    // 将一张牌从手牌移入弃牌堆
    discard: function(state, card) {
      var idx = -1;
      for (var i = 0; i < state.hand.length; i++) {
        if (state.hand[i].uid === card.uid) { idx = i; break; }
      }
      if (idx >= 0) state.hand.splice(idx, 1);
      state.discard.push(card);
      return state;
    },

    shuffle: shuffle
  };

  global.LF = global.LF || {};
  global.LF.CardSystem = CardSystem;
  if (typeof module !== 'undefined' && module.exports) module.exports = CardSystem;

})(typeof window !== 'undefined' ? window : globalThis);
