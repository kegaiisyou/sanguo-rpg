// 商店 / 商人数据（外置，便于调价与扩展新商人）
// 结构：LF.SHOPS[商店ID] = { name:'店名', items:[ {id:'物品ID', buy:买入价, sell:收购价}, ... ] }
// 价格单位：两（state.gold）。buy/sell 为 0 表示该方向不开放。
(function(){
  window.LF = window.LF || {};
  LF.SHOPS = {
    build_pedlar: {
      name: '货郎',
      items: [
        { id: 'mutou',      buy: 8,  sell: 3  },
        { id: 'xiaoshuzhi', buy: 3,  sell: 1  },
        { id: 'futou',      buy: 35, sell: 12 },
        { id: 'zhangpeng',  buy: 60, sell: 25 }
      ]
    }
    // 以后新增商人只需在此追加，例如：
    // , blacksmith: { name:'铁匠', items:[ {id:'mucai', buy:0, sell:5}, {id:'tiekuai', buy:20, sell:8} ] }
  };
})();
