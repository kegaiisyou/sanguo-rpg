/* ═══════════════════════════════════════════════════════════════
 * uiicons.js — 图标资源映射层（v20260924u）
 * 数据层仍写 emoji（rooms/engine/statusbar 各处不动），渲染层经映射换为
 * AI 生成的图标（shared/img/sm_*.png，128px 压缩版）。
 * 未映射到的 emoji 保持原样回退，保证任何遗漏都不破坏显示。
 * 用法：
 *   UI_Icons.icon(iconChar, name)   —— 场景物件/天气/入口（方形小卡）
 *   UI_Icons.avatar(name)           —— NPC 头像（圆形，按人名匹配）
 * ═══════════════════════════════════════════════════════════════ */
(function(){
  function pic(name, cls){
    return '<img class="'+cls+'" src="shared/img/sm_'+name+'.png" alt="" loading="lazy" draggable="false">';
  }
  // 按物件名精确映射（优先于 emoji，因同一 emoji 可能对应多物）
  var BY_NAME={
    '卸料台':'icn-xieliao','麻袋堆':'icn-madai','木箱':'icn-muxiang','货架':'icn-huojia',
    '水井':'icn-shuijing','乱石堆':'icn-luanshi','记工木牌':'icn-mumu','正帐':'icn-zhangpeng',
    '中军帐':'icn-zhangpeng','营帐':'icn-zhangpeng','矿坑':'icn-kuang','矿脉':'icn-kuang',
    '岩壁矿脉':'icn-kuang','矿洞':'icn-kuang','仓库':'icn-cangku','库房':'icn-cangku',
    '进入仓库':'icn-cangku',
    // v20260924z12：场景实体物 B 水墨套（assets/icons/scene48 → shared/img/sm_icn-*.png）
    '灶台':'icn-zaotai','药柜':'icn-yaogui','捣药罐':'icn-daoyao','炼药台':'icn-liantiao',
    '熬药壶':'icn-aoyao','药炉':'icn-yulu','木人桩':'icn-murenzhuang','木作台':'icn-muzuotai',
    '砖窑':'icn-zhuanyao','熔炉':'icn-ronglu','铁料堆':'icn-tieliaodui','立栅':'icn-lizha',
    '夯土基':'icn-hangtuji','简牍架':'icn-jandujia','香案':'icn-xiangan','钱柜':'icn-qianqui',
    '酒瓮':'icn-jiuweng','蒸笼':'icn-zhenglong','菜案':'icn-caian','织机':'icn-zhiji',
    '染缸':'icn-rangang','镖旗':'icn-biaoqi','马厩':'icn-majiu','骰盆':'icn-toupen'
  };
  // 通用 emoji → 图标（天气、门、常见物）
  var BY_EMOJI={
    '⛏️':'icn-xieliao','🧺':'icn-madai','📦':'icn-muxiang','🪜':'icn-huojia','⛲':'icn-shuijing',
    '🪨':'icn-luanshi','📋':'icn-mumu','⛺':'icn-zhangpeng','🚪':'icn-laomen','🏠':'icn-cangku',
    '☀':'wx-qing','🌤':'wx-duoyun','☁':'wx-yin','🌦':'wx-weiyu','🌧':'wx-dayu','❄':'wx-xue',
    '🌫':'wx-wu','🌬':'wx-feng'
  };
  // NPC 头像（按人名）
  var NPC_BY_NAME={
    '丁大牛':'npc-nongfu','陈简':'npc-wenli','吴算':'npc-zhangfang','郑刚':'npc-wufu',
    '鲁大':'npc-chushi','牢头':'npc-yuzu','仓吏':'npc-guanli','孙老':'npc-laozhe',
    '孙伯':'npc-laozhe','老孙':'npc-laozhe','周先生':'npc-laozhe',
    '秦九霄':'npc-wufu','牛铁':'npc-wufu','韩铁':'npc-wufu','韩教头':'npc-wufu',
    '苟三':'npc-nongfu','石四':'npc-nongfu','福生':'npc-nongfu',
    '赵虎':'npc-yuzu','官差':'npc-yuzu',
    '林娘':'npc-nongpo','苏娘':'npc-furen'
  };
  // v20260924z9：程序生成 NPC 按「角色」套泛用模板头像（npc_cards.js 的 role 字段 → shared/img/npc-*.png）
  var NPC_BY_ROLE={
    '门吏':'npc-sentry','营门哨兵':'npc-sentry','营中校尉':'npc-sentry','兵卒':'npc-sentry',
    '演武教头':'npc-sentry','值守主将':'npc-sentry','落单溃兵':'npc-sentry',
    '狱卒':'npc-yuzu','镣铐囚徒':'npc-yuzu',
    '脚夫':'npc-trader','坐商':'npc-trader','货郎':'npc-trader','乞儿':'npc-beggar',
    '户主':'npc-nongfu','庄头':'npc-nongfu','百姓':'npc-nongfu',
    '老妪':'npc-nongpo','说书人':'npc-scholar','主簿':'npc-scholar','宫门近臣':'npc-scholar',
    '矿工':'npc-miner','火头军':'npc-chushi','仓吏':'npc-guanli'
  };
  function icon(ic, name){
    var n = name && BY_NAME[name];
    if(n) return pic(n, 'ui-pic');
    if(ic && BY_EMOJI[ic]) return pic(BY_EMOJI[ic], 'ui-pic');
    return ic || '·';
  }
  // v20260924z20：史实武将专属头像（shared/img/npc-*.png，水墨胸像）
  var HERO_BY_NAME={
    '曹操':'npc-caocao','刘备':'npc-liubei','孙策':'npc-sunce','关羽':'npc-guanyu',
    '张飞':'npc-zhangfei','赵云':'npc-zhaoyun','诸葛亮':'npc-zhugeliang','吕布':'npc-lvbu',
    '董卓':'npc-dongzhuo','周瑜':'npc-zhouyu'
  };
  function avatar(name, role){
    if(name && HERO_BY_NAME[name]) return pic(HERO_BY_NAME[name], 'ui-ava');
    if(name && NPC_BY_NAME[name]) return pic(NPC_BY_NAME[name], 'ui-ava');
    if(role && NPC_BY_ROLE[role]) return pic(NPC_BY_ROLE[role], 'ui-ava');
    return '👤';
  }
  var _G = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : this);
  _G.UI_Icons = { icon: icon, avatar: avatar };
})();
