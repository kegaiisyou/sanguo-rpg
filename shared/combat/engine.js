(function(global) {
  'use strict';

  // ========== 战斗引擎 ==========
  // 半手动回合制 + 节拍模型 + 运招中 + 速度差额外行动

  var CombatEngine = {

    // ─── 初始化 ───
    init: function(playerState, enemyId) {
      var self = this;
      var ENEMIES = global.LF.ENEMIES;
      var MARTIAL_ARTS = global.LF.MARTIAL_ARTS;

      var enemyData = ENEMIES.get(enemyId);
      if (!enemyData) return { error: '未知敌人：' + enemyId };

      // 聚合玩家的发力技巧效果
      var forceEff = {};
      var forceIds = playerState.equippedForce || [];
      forceIds.forEach(function(fid) {
        var f = MARTIAL_ARTS.get(fid);
        if (f && f.eff) {
          for (var k in f.eff) { forceEff[k] = f.eff[k]; }
        }
      });

      // 玩家的武学 ID 列表
      var artIds = playerState.learnedMartial || [];
      // 保证新手至少能用崩拳
      if (artIds.indexOf('beng_quan') === -1) artIds.push('beng_quan');

      // ── P2：招式实际效果（含境界突破加成）映射 ──
      var artMap = {};
      artIds.forEach(function(aid) {
        var built = self._buildArt(aid, (playerState.realm && playerState.realm[aid]) || 0);
        if (built) artMap[aid] = built;
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
          hitRate: playerState.hitRate || 0.92,
          buffs: [], dots: [],
          defStance: false, stunNext: false,
          forceEff: Object.assign({}, forceEff, { critRate: (forceEff.critRate || 0) + (playerState.critRate || 0) })
        },
        enemy: {
          id: enemyData.id, name: enemyData.name, title: enemyData.title || '',
          hp: enemyData.hp, maxHp: enemyData.hp,
          atk: enemyData.atk, def: enemyData.def, spd: enemyData.spd,
          mp: 0, maxMp: 0, rage: 0, maxRage: 100,
          skills: enemyData.skills || [],
          ai: enemyData.ai || 'aggressive',
          hitRate: 0.9,
          buffs: [], dots: [],
          defStance: false, stunNext: false,
          forceEff: {}
        },
        enemyData: enemyData,
        lineGains: [],
        log: [],
        round: 0,
        result: null
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

    // ─── 计算伤害 ───
    // 伤害 = atk × dmgMul × 100 / (100 + def)，支持破甲/破防/暴伤
    calcDamage: function(actor, action, crit) {
      var unit = this.state[actor];
      var mul = (action && action.dmgMul) || 1;
      var eff = (action && action.eff) || {};
      var armorPen = (unit.forceEff.armorPen || 0) + (eff.breakDef || 0) + (eff.armorPen || 0);
      var ignoreDef = eff.ignoreDef || 0;

      var target = this.state[actor === 'player' ? 'enemy' : 'player'];
      var tDef = target.def;
      if (target.defStance) tDef = Math.round(tDef * 1.5);

      var effDef = tDef * (1 - Math.min(armorPen, 0.8)) * (1 - ignoreDef);
      var raw = Math.round(unit.atk * mul * 100 / (100 + Math.max(0, effDef)));
      if (crit) {
        var cd = 1.5 * (1 + (eff.critDmgAdd || 0));
        raw = Math.round(raw * cd);
      }
      return Math.max(1, raw);
    },

    // ─── 处理一次行动 ───
    _resolveAction: function(actor, action, log) {
      var unit = this.state[actor];
      var target = this.state[actor === 'player' ? 'enemy' : 'player'];
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
        log.push({ type:'heal', text: unit.name + '恢复 ' + heal + ' 气血' });
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
      var dmg = this.calcDamage(actor, action, hasCrit);
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

      // 记录玩家出招的艺线经验（P2：战斗出手累积）
      if (isPlayer && action.line) {
        this.state.lineGains.push({ line: action.line, crit: hasCrit });
      }

      var armorPen = (unit.forceEff.armorPen || 0) + (eff.breakDef || 0) + (eff.armorPen || 0);
      var desc = aName + '使出「' + (action.name || '普攻') + '」';
      if (hasCrit) desc += '【暴击！】';
      if (hitCount > 1) desc += ' ' + hitsDesc.join(' · ');
      desc += ' → 造成 ' + totalDmg + ' 伤害';
      if (armorPen > 0) desc += '（破甲）';
      if (eff.ignoreDef) desc += '（破防）';

      log.push({ type: isPlayer ? 'player_atk' : 'enemy_atk', text: desc, dmg: totalDmg });

      // ─── 附加效果 ───
      // 中毒
      if (eff.poisonChance && Math.random() < eff.poisonChance) {
        target.dots.push({ name:'中毒', dmg:eff.poisonDmg||8, turns:eff.poisonTurns||3 });
        log.push({ type:'debuff', text: (isPlayer ? target.name : '你') + '中毒！（每回合-' + (eff.poisonDmg||8) + '，' + (eff.poisonTurns||3) + '回合）' });
      }

      // 灼烧
      if (eff.burnChance && Math.random() < eff.burnChance) {
        target.dots.push({ name:'灼烧', dmg:eff.burnDmg||6, turns:eff.burnTurns||3 });
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

      // 反弹：当敌人攻击玩家时，玩家的震字诀反弹伤害
      if (!isPlayer && totalDmg > 0) {
        var pForce = this.state.player.forceEff;
        if (pForce.reflectDmg) {
          var reflect = Math.round(totalDmg * pForce.reflectDmg);
          if (reflect > 0) {
            this.state.enemy.hp = Math.max(0, this.state.enemy.hp - reflect);
            log.push({ type:'counter', text: '你以震字诀反弹 ' + reflect + ' 伤害！' });
          }
        }
      }

      // 消耗资源
      if (action.cost && action.cost.type === 'mp') unit.mp -= (action.cost.val || 0);
      if (action.cost && action.cost.type === 'rage') unit.rage -= (action.cost.val || 0);

      return totalDmg;
    },

    // ─── 结算 DoT ───
    _tickDots: function(log) {
      var self = this;
      ['player', 'enemy'].forEach(function(side) {
        var unit = self.state[side];
        if (!unit.dots.length) return;
        var surviving = [];
        unit.dots.forEach(function(d) {
          unit.hp = Math.max(0, unit.hp - d.dmg);
          log.push({ type:'dot', text: (side==='player'?'你':unit.name) + '受到' + d.name + ' ' + d.dmg + '点' });
          d.turns--;
          if (d.turns > 0) surviving.push(d);
        });
        unit.dots = surviving;
      });
    },

    // ─── 结算 Buff 衰减 ───
    _tickBuffs: function() {
      var self = this;
      ['player', 'enemy'].forEach(function(side) {
        var unit = self.state[side];
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
      if (this.state.enemy.hp <= 0)  { this.state.result = 'win';  return true; }
      return false;
    },

    // ─── 敌方 AI ───
    _pickEnemyAction: function() {
      var e = this.state.enemy;
      var skills = e.skills || [];
      var hpR = e.hp / Math.max(1, e.maxHp);

      if (skills.length === 0) return 'defend';

      // Boss AI
      if (e.ai === 'boss') {
        // 残血时开启狂怒
        if (hpR < 0.4) {
          var buff = null;
          for (var i = 0; i < skills.length; i++) {
            if (skills[i].passive && skills[i].eff && skills[i].eff.selfBuff) { buff = skills[i]; break; }
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

    // ─── 玩家 AI（自动模式） ───
    _pickPlayerAction: function(strategy) {
      var self = this;
      var p = this.state.player;
      var arts = p.artIds;
      var available = [];

      for (var i = 0; i < arts.length; i++) {
        var art = p.artMap[arts[i]] || global.LF.MARTIAL_ARTS.get(arts[i]);
        if (!art) continue;
        if (art.type === 'technique') continue; // 发力技巧非主动使用
        if (art.cost && art.cost.type === 'mp' && p.mp < art.cost.val) continue;
        if (art.cost && art.cost.type === 'rage' && p.rage < art.cost.val) continue;
        available.push(art);
      }

      // 无可用的——只能普防（返回字符串标识，由 _resolveAction 识别）
      if (available.length === 0) return 'defend';

      var hpR = p.hp / Math.max(1, p.maxHp);

      // ─── 保守策略 ───
      if (strategy === 'conservative') {
        if (hpR < 0.5 && Math.random() < 0.35) return 'defend';
        available.sort(function(a, b) {
          return (a.cost && a.cost.val || 0) - (b.cost && b.cost.val || 0);
        });
        return available[0];
      }

      // ─── 最优策略 ───
      // 残血 → 大招拼死一搏
      if (hpR < 0.25) {
        // 优先绝技
        var ult = null;
        for (var u = 0; u < available.length; u++) {
          if (available[u].type === 'ultimate') { ult = available[u]; break; }
        }
        if (ult) return ult;

        available.sort(function(a, b) { return (b.dmgMul || 0) - (a.dmgMul || 0); });
        return available[0];
      }

      // 绝技就绪且能斩杀
      var enemyHpR = this.state.enemy.hp / Math.max(1, this.state.enemy.maxHp);
      for (var j = 0; j < available.length; j++) {
        if (available[j].type === 'ultimate') {
          var estDmg = this.calcDamage('player', available[j], false);
          if (estDmg >= this.state.enemy.hp) return available[j];
        }
      }

      // 最高 DPS 可负担的武技
      available.sort(function(a, b) {
        var dA = (a.dmgMul || 0) / Math.max(1, a.beat || 25);
        var dB = (b.dmgMul || 0) / Math.max(1, b.beat || 25);
        return dB - dA;
      });
      return available[0];
    },

    // ─── 执行一回合（手动：传入 actionId；自动：AI 自选） ───
    playTurn: function(actionId) {
      var log = [];
      this.state.log = [];
      this.state.round++;

      // 1) DoT 结算
      this._tickDots(log);
      if (this._checkEnd()) { this.state.log = log; return log; }

      // 确定玩家行动
      var playerAction;
      if (actionId === 'defend') {
        playerAction = 'defend';
      } else if (actionId && actionId !== '__auto__') {
        playerAction = this.state.player.artMap[actionId] || global.LF.MARTIAL_ARTS.get(actionId);
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
        // 自动模式：AI 选择（策略由 autoResolve 暂存于 _autoStrat）
        var strat = (actionId === '__auto__') ? (this._autoStrat || 'optimal') : 'optimal';
        playerAction = this._pickPlayerAction(strat);
      }

      // 2) 运招中判定（beat>60 的重招）
      if (playerAction && playerAction !== 'defend' && playerAction.beat > 60) {
        log.push({ type:'system', text:'你凝神聚气，大招蓄力中——' });
        // 敌方趁机出手
        var ePreAct = this._pickEnemyAction();
        this._resolveAction('enemy', ePreAct, log);
        if (this._checkEnd()) { this.state.log = log; return log; }
      }

      // 3) 玩家行动结算
      this._resolveAction('player', playerAction, log);
      if (this._checkEnd()) { this.state.log = log; return log; }

      // 4) 敌方行动（若未在运招中抢攻）
      if (!playerAction || playerAction === 'defend' || playerAction.beat <= 60) {
        var eAct = this._pickEnemyAction();
        this._resolveAction('enemy', eAct, log);
        if (this._checkEnd()) { this.state.log = log; return log; }
      }

      // 5) 速度差额外行动
      var spdGap = this.state.player.spd - this.state.enemy.spd;
      if (spdGap > 20) {
        log.push({ type:'system', text:'你身法占优，抢出连击！' });
        // 快速追加一次轻攻击
        var quickAtk = { name:'快速追击', beat:15, dmgMul:0.6, cost:{}, guaranteed:true };
        this._resolveAction('player', quickAtk, log);
        if (this._checkEnd()) { this.state.log = log; return log; }
      } else if (spdGap < -20) {
        log.push({ type:'system', text:'敌身法极快，再度袭来！' });
        var eBonus = this._pickEnemyAction();
        this._resolveAction('enemy', eBonus, log);
        if (this._checkEnd()) { this.state.log = log; return log; }
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
        this._resolveAction('enemy', eAct, log);
        this.state.log = log;
        return { success: false, text: '未能脱身，反被追击！', log: log };
      }
    },

    // ─── 全自动战斗 ───
    autoResolve: function(strategy) {
      var fullLog = [];
      var maxRounds = 60;
      this._autoStrat = strategy || 'optimal';

      while (maxRounds-- > 0) {
        var log = this.playTurn('__auto__');
        fullLog.push.apply(fullLog, log);
        if (this.state.result) break;
      }

      if (!this.state.result) this.state.result = 'draw';

      return {
        result: this.state.result,
        log: fullLog,
        rounds: this.state.round,
        playerHp: this.state.player.hp,
        enemyHp: this.state.enemy.hp
      };
    },

    // ─── 获取战斗状态（供 UI） ───
    getStatus: function() {
      return {
        round: this.state.round,
        result: this.state.result,
        player: {
          name: this.state.player.name,
          hp: this.state.player.hp, maxHp: this.state.player.maxHp,
          mp: this.state.player.mp, maxMp: this.state.player.maxMp,
          rage: this.state.player.rage, maxRage: this.state.player.maxRage,
          buffs: this.state.player.buffs.slice(),
          dots: this.state.player.dots.slice(),
          defStance: this.state.player.defStance,
          stunNext: this.state.player.stunNext
        },
        enemy: {
          name: this.state.enemy.name,
          title: this.state.enemy.title,
          hp: this.state.enemy.hp, maxHp: this.state.enemy.maxHp,
          buffs: this.state.enemy.buffs.slice(),
          dots: this.state.enemy.dots.slice(),
          defStance: this.state.enemy.defStance,
          stunNext: this.state.enemy.stunNext
        },
        log: this.state.log.slice()
      };
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
      // ── 装备掉落（P1 完整）：按敌人 equip 配置概率生成 ──
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
