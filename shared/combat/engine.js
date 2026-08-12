(function(global) {
  'use strict';

  // ========== 战斗引擎 ==========
  // 半手动回合制 + 节拍模型 + 运招中 + 速度差额外行动
  // 卡牌战斗（v0.4）：新增多敌 enemies[] 支持与 playCard/endTurn/peekEnemyIntents。
  // 旧半手动 playTurn 路径保留（state.enemy 仍为 enemies[0] 别名），供回滚用。

  // ── P2：五行相克（金克木→土→水→火→金）──
  var ATTR_CYCLE = { '金': '木', '木': '土', '土': '水', '水': '火', '火': '金' };

  // ── P5：战意战术技能（消耗 rage 的额外可选项）──
  var RAGE_ACTIONS = {
    roar: {
      id: 'rage_roar', name: '怒吼', type: 'rage', beat: 20, dmgMul: 0,
      eff: { selfBuff: { atk: 6, spd: 5, turns: 2 } },
      cost: { type: 'rage', val: 30 },
      desc: '消耗战意，怒吼助威：攻击+6、速度+5（2回合）'
    },
    laststand: {
      id: 'rage_laststand', name: '死战', type: 'rage', beat: 20, dmgMul: 0,
      special: 'laststand', cost: { type: 'rage', val: 20 },
      desc: '残血时燃尽战意：转化为大量攻击加成'
    }
  };

  var CombatEngine = {

    // ─── 初始化 ───
    // enemyId 可为字符串（单敌，向后兼容）或数组（多敌组合）
    init: function(playerState, enemyId) {
      var self = this;
      var ENEMIES = global.LF.ENEMIES;
      var MARTIAL_ARTS = global.LF.MARTIAL_ARTS;

      var ids = Array.isArray(enemyId) ? enemyId : [enemyId];
      var enemyDatas = [];
      for (var di = 0; di < ids.length; di++) {
        var ed0 = ENEMIES.get(ids[di]);
        if (!ed0) return { error: '未知敌人：' + ids[di] };
        enemyDatas.push(ed0);
      }

      // 聚合玩家的发力技巧效果
      var forceEff = {};
      var forceIds = playerState.equippedForce || [];
      forceIds.forEach(function(fid) {
        var f = MARTIAL_ARTS.get(fid);
        if (f && f.eff) {
          for (var k in f.eff) { forceEff[k] = f.eff[k]; }
        }
      });

      // 玩家的武学 ID 列表（用副本，避免战斗初始化意外修改全局存档数组）
      var artIds = (playerState.learnedMartial || []).slice();
      // 保证新手至少能用崩拳
      if (artIds.indexOf('beng_quan') === -1) artIds.push('beng_quan');

      // ── P2：招式实际效果（含境界突破加成）映射 ──
      var artMap = {};
      artIds.forEach(function(aid) {
        var built = self._buildArt(aid, (playerState.realm && playerState.realm[aid]) || 0);
        if (built) artMap[aid] = built;
      });
      // ── P2：玩家五行（取首个带 wu 的武学，缺省「无」）──
      var pElem = '无';
      for (var ai = 0; ai < artIds.length; ai++) {
        var pa = artMap[artIds[ai]];
        if (pa && pa.attr && pa.attr.wu) { pElem = pa.attr.wu; break; }
      }

      // 构建多敌数组
      var enemies = enemyDatas.map(function(ed, idx) {
        return {
          idx: idx,
          id: ed.id, name: ed.name, title: ed.title || '',
          hp: ed.hp, maxHp: ed.hp,
          atk: ed.atk, def: ed.def, spd: ed.spd,
          mp: 0, maxMp: 0, rage: 0, maxRage: 100,
          skills: ed.skills || [],
          ai: ed.ai || 'aggressive',
          element: ed.element || '无',
          hitRate: 0.9,
          buffs: [], dots: [],
          defStance: false, stunNext: false,
          forceEff: {},
          intent: null   // 本回合该敌预告（卡牌战锁定用）
        };
      });

      this.state = {
        player: {
          name: playerState.name || '你',
          hp: playerState.hp, maxHp: playerState.maxHp,
          mp: playerState.mp || 0, maxMp: playerState.maxMp || 30,
          rage: 0, maxRage: 100,
          atk: playerState.atk || 15, def: playerState.def || 7, spd: playerState.spd || 20,
          artIds: artIds,
          artMap: artMap,
          element: playerState.element || pElem,
          hitRate: playerState.hitRate || 0.92,
          buffs: [], dots: [],
          defStance: false, stunNext: false,
          chargeMul: 1,        // 蓄力倍率（卡牌战：蓄力→重击翻倍）
          dodgeNext: false,    // 闪避姿态（卡牌战：规避本回合敌方攻击）
          forceEff: Object.assign({}, forceEff, { critRate: (forceEff.critRate || 0) + (playerState.critRate || 0) })
        },
        enemies: enemies,
        enemy: enemies[0],            // 别名，供旧半手动渲染/掉落回滚使用
        enemyData: enemyDatas[0],     // 掉落仍以首敌为基准（多敌可后续聚合）
        enemyDatas: enemyDatas,
        lineGains: [],
        log: [],
        round: 0,
        result: null,
        combo: 0,           // 玩家连击计数（P3）
        enemyIntent: null   // 本回合敌方主行动预告（旧半手动单敌用）
      };

      return { ok: true };
    },

    // ── P2：解析境界突破描述文本 → 结构化数值加成 ──
    _parseBonus: function(text) {
      var b = { dmgMulAdd: 0, critRateAdd: 0, critDmgAdd: 0, armorPenAdd: 0,
                ignoreDefAdd: 0, stunAdd: 0, extraHit: 0, forceCrit: false };
      var m;
      if ((m = text.match(/伤害\+(\d+)%/))) b.dmgMulAdd += parseInt(m[1], 10) / 100;
      else if ((m = text.match(/伤害\+(\d+)/))) b.dmgMulAdd += parseInt(m[1], 10) / 100;
      if ((m = text.match(/暴击率\+(\d+)%/))) b.critRateAdd += parseInt(m[1], 10) / 100;
      if ((m = text.match(/暴击伤害\+(\d+)%/))) b.critDmgAdd += parseInt(m[1], 10) / 100;
      if (/破甲/.test(text)) b.armorPenAdd += 0.3;
      if ((m = text.match(/无视防御(\d+)%/))) b.ignoreDefAdd += parseInt(m[1], 10) / 100;
      if ((m = text.match(/眩晕概率\+(\d+)%/))) b.stunAdd += parseInt(m[1], 10) / 100;
      if (/连击一次|追加第三腿/.test(text)) b.extraHit += 1;
      if (/必暴击/.test(text)) b.forceCrit = true;
      return b;
    },

    // ── P2：构建含境界突破的招式实际效果 ──
    _buildArt: function(id, realmLevel) {
      var MA = global.LF.MARTIAL_ARTS;
      var base = MA.get(id);
      if (!base) return null;
      var eff = {};
      if (base.eff) { for (var k in base.eff) eff[k] = base.eff[k]; }
      var art = {
        id: base.id, name: base.name, type: base.type, line: base.line,
        beat: base.beat, dmgMul: base.dmgMul, cost: base.cost,
        multiHit: base.multiHit || 1, attr: base.attr,
        desc: base.desc, eff: eff, forceCrit: false
      };
      if (base.breakthrough && realmLevel > 0) {
        var self = this;
        base.breakthrough.forEach(function(bt) {
          if (bt.realm <= realmLevel) {
            var b = self._parseBonus(bt.eff);
            art.dmgMul *= (1 + b.dmgMulAdd);
            art.eff.critRate = (art.eff.critRate || 0) + b.critRateAdd;
            art.eff.critDmgAdd = (art.eff.critDmgAdd || 0) + b.critDmgAdd;
            art.eff.armorPen = (art.eff.armorPen || 0) + b.armorPenAdd;
            art.eff.ignoreDef = (art.eff.ignoreDef || 0) + b.ignoreDefAdd;
            art.eff.stunChance = (art.eff.stunChance || 0) + b.stunAdd;
            art.multiHit += b.extraHit;
            if (b.forceCrit) art.forceCrit = true;
          }
        });
      }
      return art;
    },

    // ─── 计算伤害（targetUnit 为具体目标单位，支持多敌）───
    // 伤害 = atk × dmgMul × 100 / (100 + def)，支持破甲/破防/暴伤/属性克制
    calcDamage: function(actor, action, targetUnit, crit, attrMul) {
      var unit = this.state[actor];
      var mul = (action && action.dmgMul) || 1;
      var eff = (action && action.eff) || {};
      var armorPen = (unit.forceEff.armorPen || 0) + (eff.breakDef || 0) + (eff.armorPen || 0);
      var ignoreDef = eff.ignoreDef || 0;

      var tDef = targetUnit.def;
      if (targetUnit.defStance) tDef = Math.round(tDef * 1.5);

      var effDef = tDef * (1 - Math.min(armorPen, 0.8)) * (1 - ignoreDef);
      var raw = Math.round(unit.atk * mul * 100 / (100 + Math.max(0, effDef)));
      // 属性克制（P2）：克制 ×1.25，被克 ×0.8
      if (attrMul && attrMul !== 1) raw = Math.round(raw * attrMul);
      if (crit) {
        var cd = 1.5 * (1 + (eff.critDmgAdd || 0));
        raw = Math.round(raw * cd);
      }
      return Math.max(1, raw);
    },

    // ── P2：五行相克判定（攻方 wu vs 守方 element）──
    _attrCounter: function(action, target) {
      var aw = action && action.attr && action.attr.wu;
      var dw = target && target.element;
      if (!aw || !dw || aw === '无' || dw === '无') return { mul: 1, type: null };
      if (ATTR_CYCLE[aw] === dw) return { mul: 1.25, type: 'counter' };   // 我克你
      if (ATTR_CYCLE[dw] === aw) return { mul: 0.8, type: 'countered' };   // 你克我
      return { mul: 1, type: null };
    },

    // ── P5：战意技能合成（rage_roar / rage_laststand）──
    _rageAction: function(id) {
      if (id === 'rage_roar') return RAGE_ACTIONS.roar;
      if (id === 'rage_laststand') return RAGE_ACTIONS.laststand;
      return null;
    },

    // ─── 处理一次行动（targetUnit 为具体目标；旧半手动传 state.enemy）───
    _resolveAction: function(actor, action, log, targetUnit) {
      var self = this;
      var unit = this.state[actor];
      var target = targetUnit || this.state[actor === 'player' ? 'enemy' : 'player'];
      var aName = actor === 'player' ? '你' : unit.name;
      var isPlayer = actor === 'player';

      // 眩晕跳过
      if (unit.stunNext) {
        unit.stunNext = false;
        log.push({ type:'system', text: aName + '仍处于眩晕，无法行动！' });
        return 0;
      }

      // 防御
      if (!action || action === 'defend' || (action.id && action.id === 'defend')) {
        unit.defStance = true;
        var mpRecover = Math.round(unit.maxMp * 0.08);
        unit.mp = Math.min(unit.maxMp, unit.mp + mpRecover);
        log.push({ type:'system', text: aName + '摆出防御架势，内力+' + mpRecover });
        return 0;
      }

      // 自愈
      if (action.eff && action.eff.selfHeal) {
        var heal = action.eff.selfHeal;
        unit.hp = Math.min(unit.maxHp, unit.hp + heal);
        log.push({ type:'heal', text: unit.name + '恢复 ' + heal + ' 气血', eHp: this.state.enemies[0] ? this.state.enemies[0].hp : 0, pHp: this.state.player.hp });
        return 0;
      }

      // 自Buff
      if (action.eff && action.eff.selfBuff) {
        var b = action.eff.selfBuff;
        var txts = [];
        if (b.atk) { unit.atk += b.atk; unit.buffs.push({ type:'atk', value:b.atk, turns:b.turns }); txts.push('攻击+' + b.atk); }
        if (b.spd) { unit.spd += b.spd; unit.buffs.push({ type:'spd', value:b.spd, turns:b.turns }); txts.push('速度+' + b.spd); }
        log.push({ type:'buff', text: unit.name + '战力暴涨！' + txts.join('，') + '（' + b.turns + '回合）' });
        return 0;
      }

      // P5：死战（燃尽战意转化为攻击）
      if (action.special === 'laststand') {
        var rg = unit.rage;
        var boost = Math.floor(rg * 0.4);
        unit.atk += boost;
        log.push({ type: 'buff', text: aName + '燃尽战意，死战不退！攻击力+' + boost + '（当前 ' + unit.atk + '）' });
        return 0;
      }

      // 被动技能（不产生行动效果）
      if (action.passive) return 0;

      // ─── 正常攻击 ───
      var eff = action.eff || {};
      // 命中判定（攻击招才判定；防御/蓄力/自愈已在上方处理）
      var hitRate = unit.hitRate || 0.92;
      if (!action.guaranteed && Math.random() > hitRate) {
        log.push({ type: isPlayer ? 'player_atk' : 'enemy_atk',
          text: aName + '的「' + (action.name || '普攻') + '」被对方闪过！（未命中）' });
        if (action.cost && action.cost.type === 'mp') unit.mp -= (action.cost.val || 0);
        if (action.cost && action.cost.type === 'rage') unit.rage -= (action.cost.val || 0);
        return 0;
      }

      var hasCrit = action.forceCrit ||
        Math.random() < (0.05 + (unit.forceEff.critRate || 0) + (eff.critRate || 0));
      var acInfo = this._attrCounter(action, target);   // P2 属性克制
      var dmg = this.calcDamage(actor, action, target, hasCrit, acInfo.mul);
      var hitCount = action.multiHit || 1;
      var totalDmg = 0;
      var hitsDesc = [];

      // 防御架势标记（减伤已在上方 calcDamage 中处理）
      var hadDefStance = target.defStance;
      if (hadDefStance) {
        log.push({ type:'system', text: (isPlayer ? target.name : '你') + '以防御架势格挡！' });
        target.defStance = false;
      }

      // 多段攻击
      for (var h = 0; h < hitCount; h++) {
        var hitDmg = h === 0 ? dmg : Math.round(dmg * 0.7);
        target.hp -= hitDmg;
        totalDmg += hitDmg;
        if (hitCount > 1) hitsDesc.push((h === 0 ? '首击' : '追击') + hitDmg);
      }

      target.hp = Math.max(0, target.hp);

      // P3：连击计数（玩家连续命中累计，被打中清零）
      var comboNote = '';
      if (isPlayer && totalDmg > 0) {
        this.state.combo = (this.state.combo || 0) + 1;
        if (this.state.combo % 3 === 0) {
          var burst = Math.round(totalDmg * 0.05);
          target.hp = Math.max(0, target.hp - burst);
          totalDmg += burst;
          comboNote = ' 连击×' + this.state.combo + '！气势爆发(+' + burst + ')';
        }
      } else if (actor === 'enemy' && totalDmg > 0) {
        this.state.combo = 0;
      }

      // 记录玩家出招的艺线经验（P2：战斗出手累积）
      if (isPlayer && action.line) {
        this.state.lineGains.push({ line: action.line, crit: hasCrit });
      }

      var armorPen = (unit.forceEff.armorPen || 0) + (eff.breakDef || 0) + (eff.armorPen || 0);
      var desc = aName + '使出「' + (action.name || '普攻') + '」';
      if (hasCrit) desc += '【暴击！】';
      if (hitCount > 1) desc += ' ' + hitsDesc.join(' · ');
      if (acInfo.type === 'counter') desc += '（克制！）';
      else if (acInfo.type === 'countered') desc += '（被克）';
      desc += ' → 造成 ' + totalDmg + ' 伤害';
      if (armorPen > 0) desc += '（破甲）';
      if (eff.ignoreDef) desc += '（破防）';
      desc += comboNote;

      // 攻击武器线（供前端渲染拳印/剑痕/刀影等差异化受击特效）
      var atkLine = isPlayer ? (action.line || 'fist') : self._enemyLine(action);

      log.push({ type: isPlayer ? 'player_atk' : 'enemy_atk', text: desc, dmg: totalDmg,
        atkLine: atkLine, eHp: this.state.enemies[0] ? this.state.enemies[0].hp : 0, pHp: this.state.player.hp });

      // ─── 附加效果 ───
      // 中毒（可叠层）
      if (eff.poisonChance && Math.random() < eff.poisonChance) {
        self._addDot(target, '中毒', eff.poisonDmg||8, eff.poisonTurns||3);
        log.push({ type:'debuff', text: (isPlayer ? target.name : '你') + '中毒！（每回合-' + (eff.poisonDmg||8) + '，' + (eff.poisonTurns||3) + '回合）' });
      }

      // 灼烧（可叠层）
      if (eff.burnChance && Math.random() < eff.burnChance) {
        self._addDot(target, '灼烧', eff.burnDmg||6, eff.burnTurns||3);
        log.push({ type:'debuff', text: (isPlayer ? target.name : '你') + '被灼烧！（每回合-' + (eff.burnDmg||6) + '，' + (eff.burnTurns||3) + '回合）' });
      }

      // 眩晕
      if (eff.stunChance && Math.random() < eff.stunChance) {
        target.stunNext = true;
        log.push({ type:'debuff', text: (isPlayer ? target.name : '你') + '陷入眩晕！' });
      }

      // 减速
      if (eff.slowChance && Math.random() < eff.slowChance) {
        var slowVal = Math.round(target.spd * 0.3);
        target.buffs.push({ type:'spd', value:-slowVal, turns: eff.slowTurns||2 });
        target.spd -= slowVal;
        log.push({ type:'debuff', text: (isPlayer ? target.name : '你') + '行动变缓！（' + (eff.slowTurns||2) + '回合）' });
      }

      // 反弹：当敌人攻击玩家时，玩家的震字诀反弹伤害（伤害回弹给攻击方 unit）
      if (!isPlayer && totalDmg > 0) {
        var pForce = this.state.player.forceEff;
        if (pForce.reflectDmg) {
          var reflect = Math.round(totalDmg * pForce.reflectDmg);
          if (reflect > 0) {
            unit.hp = Math.max(0, unit.hp - reflect);
            log.push({ type:'counter', text: '你以震字诀反弹 ' + reflect + ' 伤害！', dmg: reflect, eHp: unit.hp, pHp: this.state.player.hp });
          }
        }
      }

      // 消耗资源
      if (action.cost && action.cost.type === 'mp') unit.mp -= (action.cost.val || 0);
      if (action.cost && action.cost.type === 'rage') unit.rage -= (action.cost.val || 0);

      return totalDmg;
    },

    // ─── 叠加状态（同名 DoT 叠层，层数增伤、回合取较长）───
    _addDot: function(unit, name, dmg, turns) {
      for (var i = 0; i < unit.dots.length; i++) {
        if (unit.dots[i].name === name) {
          unit.dots[i].stacks = (unit.dots[i].stacks || 1) + 1;
          unit.dots[i].dmg = dmg;
          unit.dots[i].turns = Math.max(unit.dots[i].turns, turns);
          return;
        }
      }
      unit.dots.push({ name: name, dmg: dmg, turns: turns, stacks: 1 });
    },

    // ─── 结算 DoT（按层数累计伤害）───
    _tickDots: function(log) {
      var self = this;
      ['player'].concat(this.state.enemies.map(function(e){ return 'enemy_' + e.idx; })).forEach(function(key) {
        var unit = key === 'player' ? self.state.player : self.state.enemies[parseInt(key.split('_')[1], 10)];
        if (!unit || !unit.dots.length) return;
        var surviving = [];
        unit.dots.forEach(function(d) {
          var dmg = d.dmg * (d.stacks || 1);
          unit.hp = Math.max(0, unit.hp - dmg);
          log.push({ type:'dot', text: (key==='player'?'你':unit.name) + '受' + d.name + (d.stacks>1?('×'+d.stacks):'') + ' ' + dmg + '点', dmg: dmg, side: key, eHp: self.state.enemies[0] ? self.state.enemies[0].hp : 0, pHp: self.state.player.hp });
          d.turns--;
          if (d.turns > 0) surviving.push(d);
        });
        unit.dots = surviving;
      });
    },

    // ─── 结算 Buff 衰减 ───
    _tickBuffs: function() {
      var self = this;
      var sides = [this.state.player].concat(this.state.enemies);
      sides.forEach(function(unit) {
        if (!unit.buffs.length) return;
        var surviving = [];
        unit.buffs.forEach(function(b) {
          b.turns--;
          if (b.turns > 0) {
            surviving.push(b);
          } else {
            // Buff 到期，还原
            if (b.type === 'atk') unit.atk -= b.value;
            if (b.type === 'spd') unit.spd -= b.value;
          }
        });
        unit.buffs = surviving;
      });
    },

    // ─── 检查结束 ───
    _checkEnd: function() {
      if (this.state.player.hp <= 0) { this.state.result = 'lose'; return true; }
      for (var i = 0; i < this.state.enemies.length; i++) {
        if (this.state.enemies[i].hp > 0) return false;
      }
      this.state.result = 'win'; return true;
    },

    // ─── 敌方 AI（可传入指定敌 unit；缺省取首敌，兼容旧半手动）───
    _pickEnemyAction: function(enemyUnit) {
      var e = enemyUnit || this.state.enemy;
      var skills = e.skills || [];
      var hpR = e.hp / Math.max(1, e.maxHp);

      if (skills.length === 0) return 'defend';

      // Boss AI
      if (e.ai === 'boss') {
        // 残血时开启狂怒
        if (hpR < 0.4) {
          var buff = null;
          for (var i = 0; i < skills.length; i++) {
            if (skills[i].eff && skills[i].eff.selfBuff) { buff = skills[i]; break; }
          }
          if (buff && Math.random() < 0.6) return buff;
        }

        // 玩家残血→大招斩杀
        var playerHpR = this.state.player.hp / Math.max(1, this.state.player.maxHp);
        if (playerHpR < 0.3) {
          var heavy = [];
          for (var j = 0; j < skills.length; j++) {
            if ((skills[j].dmgMul || 0) >= 1.5) heavy.push(skills[j]);
          }
          if (heavy.length) return heavy[Math.floor(Math.random() * heavy.length)];
        }

        // 常规：随机攻击技
        var atks = [];
        for (var k = 0; k < skills.length; k++) {
          if ((skills[k].dmgMul || 0) > 0) atks.push(skills[k]);
        }
        if (atks.length) return atks[Math.floor(Math.random() * atks.length)];
        return skills[Math.floor(Math.random() * skills.length)];
      }

      // 激进 AI
      if (e.ai === 'aggressive') {
        var atks2 = [];
        for (var a = 0; a < skills.length; a++) {
          if ((skills[a].dmgMul || 0) > 0) atks2.push(skills[a]);
        }
        if (atks2.length === 0) return skills[0];
        // 60% 最强招
        if (Math.random() < 0.6) {
          atks2.sort(function(x, y) { return (y.dmgMul || 0) - (x.dmgMul || 0); });
          return atks2[0];
        }
        return atks2[Math.floor(Math.random() * atks2.length)];
      }

      // 保守 AI
      if (hpR < 0.3) {
        // 找治疗技能
        for (var h = 0; h < skills.length; h++) {
          if (skills[h].eff && skills[h].eff.selfHeal) return skills[h];
        }
        if (Math.random() < 0.3) return 'defend';
      }
      var atks3 = [];
      for (var b = 0; b < skills.length; b++) {
        if ((skills[b].dmgMul || 0) > 0) atks3.push(skills[b]);
      }
      return atks3.length ? atks3[Math.floor(Math.random() * atks3.length)] : 'defend';
    },

    // 连击（身法更快时追加的轻攻击：节奏快、伤害低、必中）
    _makeQuickAtk: function() {
      return { name: '快速追击', beat: 15, dmgMul: 0.6, cost: {}, guaranteed: true };
    },

    // 由敌人招式名/描述推断武器线，供受击特效选择印记
    _enemyLine: function(skill) {
      if (!skill) return 'fist';
      var s = ((skill.id || '') + ' ' + (skill.name || '') + ' ' + (skill.desc || '')).toLowerCase();
      if (s.indexOf('刀') >= 0 || s.indexOf('slash') >= 0 || s.indexOf('blade') >= 0) return 'blade';
      if (s.indexOf('剑') >= 0 || s.indexOf('sword') >= 0) return 'sword';
      if (s.indexOf('枪') >= 0 || s.indexOf('spear') >= 0) return 'spear';
      if (s.indexOf('棍') >= 0 || s.indexOf('staff') >= 0) return 'staff';
      if (s.indexOf('锤') >= 0 || s.indexOf('hammer') >= 0) return 'hammer';
      if (s.indexOf('鞭') >= 0 || s.indexOf('whip') >= 0) return 'whip';
      if (s.indexOf('拳') >= 0 || s.indexOf('fist') >= 0 || s.indexOf('崩') >= 0) return 'fist';
      if (s.indexOf('火') >= 0 || s.indexOf('fire') >= 0 || s.indexOf('焰') >= 0) return 'fire';
      return 'fist';
    },

    // ─── 敌方意图预告（单敌，旧半手动 UI 用）───
    peekEnemyIntent: function() {
      var act = this._pickEnemyAction();
      this.state.enemyIntent = act;
      var label, threat = 'normal';
      var counter = false;   // 敌克我（预警玩家选防御/闪避）
      if (act === 'defend') {
        label = '摆出防御架势';
        threat = 'defend';
      } else {
        var dmgMul = (act && act.dmgMul) || 0;
        var name = (act && act.name) || '普攻';
        if (dmgMul >= 1.5) { label = '蓄力「' + name + '」'; threat = 'heavy'; }
        else { label = '欲施「' + name + '」'; threat = 'normal'; }
        if (act && act.attr && this._attrCounter(act, this.state.player).type === 'counter') {
          counter = true;
        }
      }
      return { action: act, label: label, threat: threat, counter: counter };
    },

    // ─── 多敌意图预告（卡牌战用）：锁定并显示每个存活敌人的意图 ───
    peekEnemyIntents: function() {
      var self = this;
      var out = [];
      this.state.enemies.forEach(function(e) {
        if (e.hp <= 0) { out.push({ idx: e.idx, dead: true }); return; }
        var act = self._pickEnemyAction(e);
        e.intent = act;   // 锁定，保证"预告 = 实际结算"
        var label, threat = 'normal', counter = false;
        if (act === 'defend') {
          label = '摆出防御架势'; threat = 'defend';
        } else {
          var dmgMul = (act && act.dmgMul) || 0;
          var name = (act && act.name) || '普攻';
          if (dmgMul >= 1.5) { label = '蓄力「' + name + '」'; threat = 'heavy'; }
          else { label = '欲施「' + name + '」'; threat = 'normal'; }
          if (act && act.attr && self._attrCounter(act, self.state.player).type === 'counter') counter = true;
        }
        out.push({ idx: e.idx, action: act, label: label, threat: threat, counter: counter });
      });
      return out;
    },

    // ─── 出一张卡（卡牌战核心入口）───
    // card: { kind, cost, target:'enemy'|'self'|'all', dmgMul?, chargeMul?, action? }
    // targetIdx: 单体目标在 enemies 中的索引（target==='self'/'all' 时忽略）
    playCard: function(card, targetIdx) {
      var self = this;
      var log = [];
      this.state.log = [];
      var player = this.state.player;

      // 逃跑特殊结算
      if (card.kind === 'flee') {
        var r = this.tryFlee();
        var flog = (r && r.log) ? r.log : [{ type:'system', text: r.text }];
        this.state.log = flog;
        return { log: flog, fled: r.success, ended: !!r.success };
      }

      // 扣除内力（能量）
      if (card.cost) player.mp = Math.max(0, player.mp - card.cost);

      if (card.kind === 'defend') {
        this._resolveAction('player', 'defend', log);
      } else if (card.kind === 'charge') {
        player.chargeMul = (player.chargeMul || 1) * (card.chargeMul || 1.6);
        log.push({ type:'buff', text: '你凝神蓄力，下击伤害×' + player.chargeMul.toFixed(2) });
      } else if (card.kind === 'dodge') {
        player.dodgeNext = true;
        log.push({ type:'buff', text: '你身形虚晃，准备闪避本回合攻击' });
      } else if (card.kind === 'attack' || card.kind === 'skill') {
        // 基础攻击卡把战斗参数挂在卡牌顶层（dmgMul/attr/multiHit/eff/line/name），
        // 而 card.action 为 undefined —— 必须并入 action，否则重击的 1.6 倍率等会被丢弃
        var action = Object.assign({}, card.action || {});
        if (card.dmgMul != null) action.dmgMul = (action.dmgMul || 1) * card.dmgMul;
        if (card.attr) action.attr = card.attr;
        if (card.multiHit) action.multiHit = card.multiHit;
        if (card.eff) action.eff = Object.assign({}, action.eff, card.eff);
        if (card.line) action.line = card.line;
        if (!action.name) action.name = card.name;
        if (card.forceCrit) action.forceCrit = true;
        if (card.guaranteed) action.guaranteed = true;
        // 应用蓄力倍率
        if (player.chargeMul && player.chargeMul > 1) {
          action.dmgMul = (action.dmgMul || 1) * player.chargeMul;
          player.chargeMul = 1;
        }
        var targets = [];
        if (card.target === 'self') {
          targets.push(this.state.player);   // 自我增益 / 治疗
        } else if (card.target === 'all') {
          this.state.enemies.forEach(function(e) { if (e.hp > 0) targets.push(e); });
        } else {
          var t = this.state.enemies[targetIdx];
          if (!t || t.hp <= 0) {
            // 目标已亡，自动选首个存活敌
            for (var i = 0; i < this.state.enemies.length; i++) {
              if (this.state.enemies[i].hp > 0) { t = this.state.enemies[i]; break; }
            }
          }
          if (t) targets.push(t);
        }
        var selfRef = this;
        targets.forEach(function(tgt) {
          selfRef._resolveAction('player', action, log, tgt);
        });
      } else {
        log.push({ type:'system', text: '未知卡牌：' + card.kind });
      }

      this.state.log = log;
      return { log: log, ended: this.state.result !== null };
    },

    // ─── 结束玩家回合（卡牌战：敌方阶段 + DoT/Buff 结算 + 抽牌准备）───
    endTurn: function() {
      var self = this;
      var log = [];
      this.state.log = [];
      var _snap = this;
      var _origPush = log.push.bind(log);
      log.push = function (entry) {
        entry = entry || {};
        if (typeof entry.eHp !== 'number') entry.eHp = (_snap.state.enemies[0] ? _snap.state.enemies[0].hp : 0);
        if (typeof entry.pHp !== 'number') entry.pHp = _snap.state.player.hp;
        return _origPush(entry);
      };

      // 1) DoT 结算（玩家 + 各敌）
      this._tickDots(log);
      if (this._checkEnd()) { this.state.log = log; return { log: log, ended: true }; }

      // 2) 敌方阶段：存活敌人依次行动（使用锁定的意图）
      var alive = this.state.enemies.filter(function(e) { return e.hp > 0; });
      for (var i = 0; i < alive.length; i++) {
        var e = alive[i];
        if (e.stunNext) { e.stunNext = false; log.push({ type:'system', text: e.name + '眩晕，无法行动！' }); continue; }
        // 闪避姿态：规避本回合所有敌方攻击
        if (this.state.player.dodgeNext) {
          log.push({ type:'system', text: e.name + '的攻击被你闪身避开！' });
          continue;
        }
        var act = e.intent || this._pickEnemyAction(e);
        e.intent = null;  // 消费意图
        this._resolveAction('enemy', act, log, this.state.player);
        if (this._checkEnd()) { this.state.log = log; return { log: log, ended: true }; }
      }

      // 3) Buff 衰减
      this._tickBuffs();

      // 4) 回合推进
      this.state.round++;

      // 5) 清理瞬态、恢复能量（内力每回合重置为上限）
      this.state.player.chargeMul = 1;
      this.state.player.dodgeNext = false;
      this.state.player.mp = this.state.player.maxMp;
      this.state.player.rage = Math.min(100, this.state.player.rage + 12);
      for (var j = 0; j < this.state.enemies.length; j++) {
        this.state.enemies[j].rage = Math.min(100, this.state.enemies[j].rage + 8);
      }

      this.state.log = log;
      return { log: log, ended: this.state.result !== null };
    },

    // ─── 执行一回合（半手动：传入玩家指令 actionId，单敌）───
    playTurn: function(actionId) {
      var log = [];
      // 给每条战斗日志在「出招当时」即时打上血量快照
      var _snap = this;
      var _origPush = log.push.bind(log);
      log.push = function (entry) {
        entry = entry || {};
        if (typeof entry.eHp !== 'number') entry.eHp = _snap.state.enemy.hp;
        if (typeof entry.pHp !== 'number') entry.pHp = _snap.state.player.hp;
        return _origPush(entry);
      };
      this.state.log = [];
      this.state.round++;
      var stunnedThisTurn = !!this.state.player.stunNext;

      // 1) DoT 结算
      this._tickDots(log);
      if (this._checkEnd()) { this.state.log = log; return log; }

      // 确定玩家行动（战斗为半手动：actionId 由玩家指令传入）
      var playerAction;
      if (actionId === 'defend') {
        playerAction = 'defend';
      } else if (actionId) {
        playerAction = this.state.player.artMap[actionId] || global.LF.MARTIAL_ARTS.get(actionId) || this._rageAction(actionId);
        if (!playerAction) { log.push({ type:'system', text:'未知招式' }); this.state.log = log; return log; }
        // 校验消耗
        if (playerAction.cost && playerAction.cost.type === 'mp' && this.state.player.mp < playerAction.cost.val) {
          log.push({ type:'system', text:'内力不足！' });
          this.state.log = log; return log;
        }
        if (playerAction.cost && playerAction.cost.type === 'rage' && this.state.player.rage < playerAction.cost.val) {
          log.push({ type:'system', text:'战意不足！' });
          this.state.log = log; return log;
        }
      } else {
        // 兜底（正常不会走到）：默认普通攻击，避免空指令卡死
        var _fb = this.state.player.artIds && this.state.player.artIds[0];
        playerAction = (_fb && (this.state.player.artMap[_fb] || global.LF.MARTIAL_ARTS.get(_fb))) || 'defend';
      }

      // ── 行动阶段：按「速度/节拍」排定出手顺序，速度快者先手并可连击 ──
      // 2) 运招中（重招 beat>60）：敌抢先出手一次（视作敌之本回合主行动）
      var heavyPreempt = (playerAction && playerAction !== 'defend' && playerAction.beat > 60);
      var enemyMainDone = false;
      if (heavyPreempt) {
        log.push({ type:'system', text:'你凝神聚气，大招蓄力中——' });
        var ePreAct = this._pickEnemyAction();
        this._resolveAction('enemy', ePreAct, log, this.state.player);
        if (this._checkEnd()) { this.state.log = log; return log; }
        enemyMainDone = true;
      }

      // 3) 计算本回合双方出手次数
      var spdGap = this.state.player.spd - this.state.enemy.spd;
      var extra = Math.min(3, Math.floor(Math.abs(spdGap) / 20));
      var pCount = 1, eCount = 1;
      if (playerAction === 'defend') pCount = 1;
      else if (spdGap > 20 && !stunnedThisTurn) pCount += extra;   // 玩家更快 → 追连击
      else if (spdGap < -20) eCount += extra;                       // 敌更快 → 敌连击

      // 4) 排定出手队列
      var pFirst = spdGap >= 0;
      var eMain = (enemyMainDone ? null : (this.state.enemyIntent || this._pickEnemyAction()));
      this.state.enemyIntent = null;
      var pi = 0, ei = enemyMainDone ? 1 : 0;
      while (pi < pCount || ei < eCount) {
        if (pFirst) {
          if (pi < pCount) {
            if (pi === 0 && spdGap >= 20) log.push({ type:'system', text:'你身法更快，抢得先机！' });
            else if (pi === 1) log.push({ type:'system', text:'你身法占优，抢出连击！' });
            else if (pi > 1) log.push({ type:'system', text:'你身法如电，又夺一击！' });
            this._resolveAction('player', (pi === 0 ? playerAction : this._makeQuickAtk()), log, this.state.enemy);
            if (this._checkEnd()) { this.state.log = log; return log; }
            pi++;
          }
          if (ei < eCount) {
            if (ei === 0 && spdGap <= -20) log.push({ type:'system', text:'敌身法更快，抢得先机！' });
            else if (ei === 1) log.push({ type:'system', text:'敌身法极快，再度袭来！' });
            else if (ei > 1) log.push({ type:'system', text:'敌势如疾风，又是一击！' });
            this._resolveAction('enemy', (ei === 0 ? eMain : this._pickEnemyAction()), log, this.state.player);
            if (this._checkEnd()) { this.state.log = log; return log; }
            ei++;
          }
        } else {
          if (ei < eCount) {
            if (ei === 0 && spdGap <= -20) log.push({ type:'system', text:'敌身法更快，抢得先机！' });
            else if (ei === 1) log.push({ type:'system', text:'敌身法极快，再度袭来！' });
            else if (ei > 1) log.push({ type:'system', text:'敌势如疾风，又是一击！' });
            this._resolveAction('enemy', (ei === 0 ? eMain : this._pickEnemyAction()), log, this.state.player);
            if (this._checkEnd()) { this.state.log = log; return log; }
            ei++;
          }
          if (pi < pCount) {
            if (pi === 0 && spdGap >= 20) log.push({ type:'system', text:'你身法更快，抢得先机！' });
            else if (pi === 1) log.push({ type:'system', text:'你身法占优，抢出连击！' });
            else if (pi > 1) log.push({ type:'system', text:'你身法如电，又夺一击！' });
            this._resolveAction('player', (pi === 0 ? playerAction : this._makeQuickAtk()), log, this.state.enemy);
            if (this._checkEnd()) { this.state.log = log; return log; }
            pi++;
          }
        }
      }

      // 6) 战意增长
      this.state.player.rage = Math.min(100, this.state.player.rage + 12);
      this.state.enemy.rage = Math.min(100, this.state.enemy.rage + 8);

      // 7) Buff 衰减
      this._tickBuffs();

      this.state.log = log;
      return log;
    },

    // ─── 逃跑 ───
    tryFlee: function() {
      var spdDiff = this.state.player.spd - this.state.enemy.spd;
      var chance = Math.min(0.9, Math.max(0.1, 0.4 + spdDiff * 0.02));
      if (Math.random() < chance) {
        this.state.result = 'fled';
        return { success: true, text: '你寻隙脱出战圈，全身而退。' };
      } else {
        // 逃跑失败，白送敌方一回合
        var log = [];
        log.push({ type:'system', text:'撤退失败！敌方趁机攻击——' });
        var eAct = this._pickEnemyAction();
        this._resolveAction('enemy', eAct, log, this.state.player);
        this._checkEnd();
        this.state.log = log;
        return { success: false, text: '未能脱身，反被追击！', log: log };
      }
    },

    // ─── 获取战斗状态（供 UI）───
    getStatus: function() {
      var self = this;
      var enemies = this.state.enemies.map(function(e) {
        return {
          idx: e.idx, id: e.id, name: e.name, title: e.title,
          hp: e.hp, maxHp: e.maxHp, element: e.element,
          buffs: e.buffs.slice(), dots: e.dots.slice(),
          defStance: e.defStance, stunNext: e.stunNext,
          intent: e.intent ? { label: (e.intent === 'defend' ? '摆出防御架势' : ('欲施「' + (e.intent.name || '普攻') + '」')), threat: (e.intent !== 'defend' && (e.intent.dmgMul || 0) >= 1.5 ? 'heavy' : 'normal'), counter: !!(e.intent && e.intent.attr && CombatEngine._attrCounterStatic(e.intent, self.state.player.element)) } : null
        };
      });
      return {
        round: this.state.round,
        result: this.state.result,
        player: {
          name: this.state.player.name,
          hp: this.state.player.hp, maxHp: this.state.player.maxHp,
          mp: this.state.player.mp, maxMp: this.state.player.maxMp,
          rage: this.state.player.rage, maxRage: this.state.player.maxRage,
          element: this.state.player.element,
          combo: this.state.combo || 0,
          buffs: this.state.player.buffs.slice(),
          dots: this.state.player.dots.slice(),
          defStance: this.state.player.defStance,
          stunNext: this.state.player.stunNext,
          chargeMul: this.state.player.chargeMul || 1,
          dodgeNext: this.state.player.dodgeNext
        },
        enemy: {
          id: this.state.enemy.id,
          name: this.state.enemy.name,
          title: this.state.enemy.title,
          hp: this.state.enemy.hp, maxHp: this.state.enemy.maxHp,
          element: this.state.enemy.element,
          buffs: this.state.enemy.buffs.slice(),
          dots: this.state.enemy.dots.slice(),
          defStance: this.state.enemy.defStance,
          stunNext: this.state.enemy.stunNext
        },
        enemies: enemies,
        log: this.state.log.slice()
      };
    },

    // 静态属性克制判定（getStatus 用，避免依赖 this）
    _attrCounterStatic: function(action, targetElement) {
      var aw = action && action.attr && action.attr.wu;
      var dw = targetElement;
      if (!aw || !dw || aw === '无' || dw === '无') return false;
      return ATTR_CYCLE[aw] === dw;
    },

    getDrop: function() {
      var ed = this.state.enemyData;
      if (!ed || !ed.drop) return { gold: 0, pot: 0, items: [] };
      var d = ed.drop;
      var gold = d.gold ? Math.floor(d.gold[0] + Math.random() * (d.gold[1] - d.gold[0] + 1)) : 0;
      var pot = d.pot ? Math.floor(d.pot[0] + Math.random() * (d.pot[1] - d.pot[0] + 1)) : 0;
      var items = [];
      if (d.table && d.table.length) {
        d.table.forEach(function(t) {
          if (Math.random() * 100 < (t.weight || 5)) {
            items.push({ id: t.item, name: t.name || t.item });
          }
        });
      }
      var equip = null;
      var ITEMS = global.LF && global.LF.ITEMS;
      if (ITEMS && d.equip && d.equip.tier && Math.random() * 100 < (d.equip.chance || 0)) {
        equip = ITEMS.rollEquip(d.equip.tier);
      }
      return { gold: gold, pot: pot, items: items, equip: equip };
    },

    getEnemy: function() {
      return this.state.enemyData;
    },

    getPlayerActionList: function() {
      var self = this;
      var p = this.state.player;
      var list = [];
      for (var i = 0; i < p.artIds.length; i++) {
        var art = p.artMap[p.artIds[i]] || global.LF.MARTIAL_ARTS.get(p.artIds[i]);
        if (!art) continue;
        if (art.type === 'technique') continue; // 不显示为行动选项
        var affordable = true;
        if (art.cost && art.cost.type === 'mp' && p.mp < art.cost.val) affordable = false;
        if (art.cost && art.cost.type === 'rage' && p.rage < art.cost.val) affordable = false;
        list.push({
          id: art.id, name: art.name, type: art.type, beat: art.beat,
          dmgMul: art.dmgMul, cost: art.cost, attr: art.attr,
          desc: art.desc || '', affordable: affordable, multiHit: art.multiHit
        });
      }
      if (p.rage >= 30) {
        list.push({ id: 'rage_roar', name: '怒吼', type: 'rage', beat: RAGE_ACTIONS.roar.beat,
          dmgMul: 0, cost: RAGE_ACTIONS.roar.cost, attr: null, desc: RAGE_ACTIONS.roar.desc,
          affordable: true, multiHit: 1 });
      }
      if (p.hp < p.maxHp * 0.3 && p.rage >= 20) {
        list.push({ id: 'rage_laststand', name: '死战', type: 'rage', beat: RAGE_ACTIONS.laststand.beat,
          dmgMul: 0, cost: RAGE_ACTIONS.laststand.cost, attr: null, desc: RAGE_ACTIONS.laststand.desc,
          affordable: true, multiHit: 1 });
      }
      return list;
    },

    // ── P2：返回本场战斗玩家出招的艺线经验累积 ──
    getLineGains: function() {
      return this.state.lineGains || [];
    }

  };

  // 导出
  global.LF = global.LF || {};
  global.LF.CombatEngine = CombatEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = CombatEngine;

})(typeof window !== 'undefined' ? window : globalThis);
