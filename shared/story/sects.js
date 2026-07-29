// 乱世烽火 · 门派设定（共享数据层 · 文字放置路线）
//
// ⚠ 方向调整（2026-07-28）：门派不再于开局强制/自选。
//   主角以"江湖散人 / 游侠"身份起事，门派（颍川义军 / 太平道 / 西凉军）作为
//   【中后期可选补充玩法】——玩家在游戏推进到一定阶段（声望 / 进度节点）后，
//   方可主动加入（数据层由 shared/index.js 的 joinSect 落地，UI 交互待接入）。
//   因此本文件只描述"若加入可得什么"，不再决定开局身份。
//
// 字段说明：
//   faction  阵营倾向（决定主线立场底色与可被哪方势力接纳）
//   elem     五行倾向（影响五行相生/相克的小幅加成，见战斗内核）
//   style    门风（文字铭牌描述）
//   grievance 恩怨线（与其他势力 / 门派的宿怨或盟友，驱动后续抉择事件）
//   martials 门派武学 / 传功（display 用；加入时由 startingSkills 实际授予）
//   quest    门派任务（补充玩法循环：任务 → 传功 → 阵营声望）
//   unlock   加入条件（中后期门槛；reputation=声望，level=等级，flag=需先触发的剧情节点）
//   bonus / startingSkills / apt 同前（由 applySect / joinSect 套用）
(function (global) {
  var SECTS = {
    yingchuan: {
      id: 'yingchuan', name: '颍川义军',
      desc: '草莽起兵，攻守均衡，最宜新手；乡里结寨、保境安民。',
      style: '颍水之畔，义从结寨。旌旗朴素，刀枪却利——保乡里、诛暴虐，乱世里最接地气的一支。',
      faction: '汉室忠义 · 颍川士族',
      elem: '土',                         // 守土之象
      bonus: { atk: 2, def: 2, maxHp: 20 },
      apt: { jinli: 1, gengu: 1 },        // 均衡加成
      startingSkills: ['basic_fist'],
      martials: ['颍川战法（群战阵势）', '乡勇刀（守土刀法）', '结寨策（防御心法）'],
      grievance: [
        { target: '太平道', type: '敌对', desc: '流寇劫掠乡里，与义军势同水火，见则必战。' },
        { target: '西凉军', type: '戒备', desc: '凉州边军跋扈，日后或与董卓同流，需早做防备。' }
      ],
      quest: '剿匪安乡：累计讨平盗匪游散，传功长老授「颍川战法」，并提升义军声望。',
      unlock: { reputation: 15 }          // 声望初立后方可率众入盟
    },
    taiping: {
      id: 'taiping', name: '太平道',
      desc: '信奉黄天，内力深厚，擅奇术；底层民心所向，却也为朝廷所忌。',
      style: '苍天已死，黄天当立。符水疗伤、咒术摄魂，太平道的道袍下藏着改天换地的野心。',
      faction: '黄天 · 底层秘教',
      elem: '水',                         // 符水之象
      bonus: { maxMp: 30, atk: 1 },
      apt: { wuxing: 2, fuyuan: 1 },      // 悟性、福缘见长
      startingSkills: ['basic_fist', 'tu_na'],
      martials: ['太平咒（符箓奇术）', '吐纳术（内功根基）', '太平力士诀（蛮力外功）'],
      grievance: [
        { target: '颍川义军', type: '敌对', desc: '义军保境剿流寇，两方相见分外眼红。' },
        { target: '十常侍 / 朝廷', type: '死仇', desc: '甲子年举事，与朝堂势不两立，遭四方围剿。' }
      ],
      quest: '甲子密谋：完成传道与聚义事件，授「太平咒」，并卷入太平道主线抉择（侠义 / 凶名双轨在此分野）。',
      unlock: { reputation: 20, flag: 'met_zhangjiao' } // 需先遇张角方入道
    },
    xiliang: {
      id: 'xiliang', name: '西凉军',
      desc: '边军悍勇，攻击凌厉，血厚耐战；凉州铁骑，令中原闻风。',
      style: '大漠孤烟，铁骑如风。西凉儿的弯刀饮过匈奴血，也终将饮尽中原的纷争。',
      faction: '凉州军阀 · 边军悍卒',
      elem: '金',                         // 锋金之象
      bonus: { atk: 4, maxHp: 40, def: 1 },
      apt: { gengu: 2, jinli: 1 },        // 根骨、劲力见长
      startingSkills: ['basic_fist'],
      martials: ['西凉刀法（悍勇劈砍）', '铁骑冲阵（骑战之术）', '凉州硬功（外门横练）'],
      grievance: [
        { target: '颍川义军', type: '戒备', desc: '义军守土，凉军拓边，立场相左，日后或兵戎相见。' },
        { target: '并州军', type: '竞争', desc: '吕布胚所在的并州狼骑，与西凉铁骑争锋边军第一。' }
      ],
      quest: '凉州投效：于边军线立下战功，授「西凉刀法」，并成为董卓/马腾阵营的可用力量（影响群雄割据分支）。',
      unlock: { reputation: 25, level: 8 } // 需身经百战、声名鹊起
    }
  };
  global.LF = global.LF || {};
  global.LF.SECTS = SECTS;
  if (typeof module !== 'undefined' && module.exports) module.exports = SECTS;
})(typeof window !== 'undefined' ? window : globalThis);
