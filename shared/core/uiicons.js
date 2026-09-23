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
    '进入仓库':'icn-cangku'
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
  function icon(ic, name){
    var n = name && BY_NAME[name];
    if(n) return pic(n, 'ui-pic');
    if(ic && BY_EMOJI[ic]) return pic(BY_EMOJI[ic], 'ui-pic');
    return ic || '·';
  }
  function avatar(name){
    if(name && NPC_BY_NAME[name]) return pic(NPC_BY_NAME[name], 'ui-ava');
    return '👤';
  }
  var _G = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : this);
  _G.UI_Icons = { icon: icon, avatar: avatar };
})();
