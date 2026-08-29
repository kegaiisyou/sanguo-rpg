// 商店 / 商人数据（外置，便于调价与扩展新商人）
// 结构：LF.SHOPS[商店ID] = { name:'店名', items:[ {id:'物品ID', buy:买入价, sell:收购价}, ... ] }
// 价格单位：两（state.gold）。buy/sell 为 0 表示该方向不开放。
(function(){
  window.LF = window.LF || {};
  LF.SHOPS = {
    build_pedlar: {
      name: '货郎',
      items: [
        { id: 'mutou',       buy: 8,  sell: 3  },
        { id: 'xiaoshuzhi',  buy: 3,  sell: 1  },
        { id: 'shitiao',     buy: 10, sell: 4  },
        { id: 'tiekuangshi', buy: 14, sell: 6  },
        { id: 'zhuan',       buy: 18, sell: 7  },
        { id: 'tuzhi_yeolian', buy: 30, sell: 10 },
        { id: 'tuzhi_woodcamp', buy: 24, sell: 8 },
        { id: 'tuzhi_yaolu', buy: 24, sell: 8 },
        { id: 'tuzhi_house', buy: 18, sell: 6 },
        { id: 'tuzhi_market', buy: 30, sell: 10 },
        { id: 'tuzhi_farm', buy: 20, sell: 7 },
        { id: 'tuzhi_barracks', buy: 36, sell: 12 },
        { id: 'futou',       buy: 35, sell: 12 },
        { id: 'zhangpeng',   buy: 60, sell: 25 },
        { id: 'gongzuotai',  buy: 40, sell: 15 },
        { id: 'campfire',    buy: 12, sell: 4  },
        { id: 'sleepmat',    buy: 20, sell: 8  },
        { id: 'ceshizhizhu', buy: 888, sell: 300 }
      ]
    },
    doctor: {
      name: '药铺',
      items: [
        { id: 'jinchuang', buy: 30, sell: 12 },
        { id: 'roubao',    buy: 8,  sell: 3  },
        { id: 'caoyao',    buy: 5,  sell: 2  }
      ]
    }
    // 以后新增商人只需在此追加，例如：
    // , blacksmith: { name:'铁匠', items:[ {id:'mucai', buy:0, sell:5}, {id:'tiekuai', buy:20, sell:8} ] }
  };
})();
