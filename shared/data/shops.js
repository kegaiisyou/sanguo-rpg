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
        { id: 'ceshizhizhu', buy: 888, sell: 300 },
        // —— 扩充：食材 / 资材 / 铁料 / 兵器 / 行囊 ——
        { id: 'shengrou',     buy: 12, sell: 4 },
        { id: 'xiang',        buy: 6,  sell: 2 },
        { id: 'mucai',        buy: 20, sell: 8 },
        { id: 'tiekuai',      buy: 40, sell: 16 },
        { id: 'tiefu',        buy: 70, sell: 28 },
        { id: 'tiema',        buy: 22, sell: 8 },
        { id: 'tiejian',      buy: 90, sell: 35 },
        // —— 农事与杂项（v20260915g）：登记为「可交易」的泛用物 ——
        //   任务物不等于一次性道具：菜蔬、种子、绳、布、锄头出了营照样有用，故一并上架。
        //   （劳字木片 / 腰牌 / 路引 / 残页 不在其列：那是凭证与脏物，货郎不收。）
        { id: 'rope',         buy: 10, sell: 4 },
        { id: 'bumu',         buy: 8,  sell: 3 },
        { id: 'chutu',        buy: 12, sell: 4 },
        { id: 'caizi',        buy: 3,  sell: 1 },
        { id: 'douzhong',     buy: 6,  sell: 2 },
        { id: 'dou',          buy: 10, sell: 4 },
        { id: 'douzhou',      buy: 14, sell: 5 },
        { id: 'yecai',        buy: 3,  sell: 1 },
        { id: 'fan',          buy: 5,  sell: 1 },
        { id: 'shutong',      buy: 28, sell: 10 },
        { id: 'pibao',        buy: 50, sell: 20 },
        { id: 'caiyaobiluo',  buy: 45, sell: 18 },
        // —— 东汉风新增：石器兵器 / 竹器 / 兽皮蛇类掉落物（buy:0 表示仅可寄售，不在货架陈列）——
        { id: 'shidao',  buy: 35, sell: 14 },
        { id: 'gumao',   buy: 55, sell: 22 },
        { id: 'mugong',  buy: 45, sell: 18 },
        { id: 'zhujia',  buy: 60, sell: 24 },
        { id: 'zhujian', buy: 8,  sell: 3  },
        { id: 'maopi',   buy: 0,  sell: 6  },
        { id: 'shedan',  buy: 0,  sell: 10 },
        { id: 'shepi',   buy: 0,  sell: 8  },
        // —— 新物品（v20260927t）：农具 / 种子 / 作物 / 半成品 / 食材 / 畜牧 / 牲畜 / 建材 ——
        { id: 'tieding',  buy: 35, sell: 14 },
        { id: 'shihui',   buy: 6,  sell: 2  },
        { id: 'zhucai',   buy: 8,  sell: 3  },
        { id: 'liandao',  buy: 18, sell: 7  },
        { id: 'tiechan',  buy: 22, sell: 8  },
        { id: 'li',       buy: 40, sell: 15 },
        { id: 'mutong',   buy: 10, sell: 4  },
        { id: 'maizhong', buy: 4,  sell: 1  },
        { id: 'daozhong', buy: 4,  sell: 1  },
        { id: 'caizhong', buy: 3,  sell: 1  },
        { id: 'yaozhong', buy: 5,  sell: 2  },
        { id: 'xiaomai',  buy: 8,  sell: 3  },
        { id: 'qingcai',  buy: 4,  sell: 1  },
        { id: 'mianfen',  buy: 10, sell: 4  },
        { id: 'dami',     buy: 12, sell: 4  },
        { id: 'you',      buy: 14, sell: 5  },
        { id: 'jiang',    buy: 8,  sell: 3  },
        { id: 'bupi',     buy: 16, sell: 6  },
        { id: 'jidan',    buy: 4,  sell: 1  },
        { id: 'niunai',   buy: 6,  sell: 2  },
        { id: 'yangmao',  buy: 10, sell: 4  },
        { id: 'pige',     buy: 22, sell: 9  },
        { id: 'fengmi',   buy: 18, sell: 7  },
        { id: 'zhurou',   buy: 11, sell: 4  },
        { id: 'yangrou',  buy: 14, sell: 5  },
        { id: 'jirou',    buy: 10, sell: 4  },
        { id: 'niurou',   buy: 17, sell: 6  },
        { id: 'xiaozhu',  buy: 28, sell: 10 },
        { id: 'xiaoyang', buy: 33, sell: 12 },
        { id: 'xiaoji',   buy: 12, sell: 4  },
        { id: 'xiaoniu',  buy: 65, sell: 24 },
        // 财货仅收售（buy:0 不上架）：值钱之物，货郎担上收得，转手钱庄
        { id: 'jintiao',  buy: 0,  sell: 60 },
        { id: 'yinding',  buy: 0,  sell: 30 },
        { id: 'yupei',    buy: 0,  sell: 45 },
        { id: 'shouzhuo', buy: 0,  sell: 35 },
        { id: 'zhenzhu',  buy: 0,  sell: 25 }
      ]
    },
    doctor: {
      name: '药铺',
      items: [
        { id: 'jinchuang', buy: 30, sell: 12 },
        { id: 'roubao',    buy: 8,  sell: 3  },
        { id: 'caoyao',    buy: 5,  sell: 2  },
        // —— 新物品（v20260927t）：药种 / 名贵药材 ——
        { id: 'caizhong',  buy: 4,  sell: 1  },
        { id: 'yaozhong',  buy: 6,  sell: 2  },
        { id: 'renshen',   buy: 95, sell: 30 },
        { id: 'lingzhi',   buy: 85, sell: 25 }
      ]
    },
    // ── 坊·市坊四号（v20260927e）：城内坊格「交易」按铺名开对应商号 ──
    //   物品 id 均取自既有 ITEMS（与 build_pedlar/doctor 同源），不新造道具。
    blacksmith: {
      name: '铁匠铺',
      items: [
        { id: 'tiekuai', buy: 42, sell: 16 },
        { id: 'tiejian', buy: 95, sell: 35 },
        { id: 'tiefu',   buy: 74, sell: 28 },
        { id: 'futou',   buy: 38, sell: 12 },
        { id: 'tiema',   buy: 24, sell: 8  },
        // —— 新物品（v20260927t）：铁锭 / 铁农具 ——
        { id: 'tieding', buy: 38, sell: 15 },
        { id: 'tiechan', buy: 24, sell: 8  },
        { id: 'liandao', buy: 20, sell: 7  },
        { id: 'li',      buy: 42, sell: 15 },
        // —— 新物品（v20260928g）：精铁 ——
        { id: 'jingtie', buy: 80, sell: 30 }
      ]
    },
    tavern: {
      name: '酒楼',
      items: [
        { id: 'fan',      buy: 6,  sell: 1 },
        { id: 'jiu',      buy: 18, sell: 6 },
        { id: 'roubao',   buy: 9,  sell: 3 },
        { id: 'douzhou',  buy: 15, sell: 5 },
        { id: 'shengrou', buy: 13, sell: 4 },
        // —— 新物品（v20260927t）：食材半成品上架 / 肉蛋奶收售 ——
        { id: 'dami',     buy: 13, sell: 4 },
        { id: 'mianfen',  buy: 11, sell: 4 },
        { id: 'qingcai',  buy: 5,  sell: 1 },
        { id: 'you',      buy: 16, sell: 5 },
        { id: 'jiang',    buy: 9,  sell: 3 },
        { id: 'jidan',    buy: 5,  sell: 1 },
        { id: 'niunai',   buy: 7,  sell: 2 },
        { id: 'fengmi',   buy: 20, sell: 7 },
        { id: 'zhurou',   buy: 0,  sell: 4  },
        { id: 'yangrou',  buy: 0,  sell: 5  },
        { id: 'jirou',    buy: 0,  sell: 4  },
        { id: 'niurou',   buy: 0,  sell: 6  },
        // —— 新物品（v20260928g）：烹制菜肴上架 ——
        { id: 'hongshao', buy: 22, sell: 8  },
        { id: 'kaoji',    buy: 18, sell: 6  },
        { id: 'kaoyang',  buy: 24, sell: 9  }
      ]
    },
    cloth: {
      name: '布庄',
      items: [
        { id: 'bumu',  buy: 9,  sell: 3 },
        { id: 'rope',  buy: 11, sell: 4 },
        { id: 'pibao', buy: 55, sell: 20 },
        { id: 'maopi', buy: 0,  sell: 6 },
        // —— 新物品（v20260927t）：布匹 / 羊毛 / 皮革 ——
        { id: 'bupi',    buy: 18, sell: 7  },
        { id: 'yangmao', buy: 12, sell: 4  },
        { id: 'pige',    buy: 24, sell: 9  }
      ]
    },
    bank: {
      name: '钱庄',
      items: [
        { id: 'shutong',     buy: 30, sell: 10 },
        { id: 'caiyaobiluo', buy: 48, sell: 18 },
        { id: 'shepi',       buy: 0,  sell: 8  },
        { id: 'shedan',      buy: 0,  sell: 10 },
        // —— 新物品（v20260927t）：钱庄专收财货，高价兑付 ——
        { id: 'jintiao',  buy: 0, sell: 65 },
        { id: 'yinding',  buy: 0, sell: 32 },
        { id: 'yupei',    buy: 0, sell: 48 },
        { id: 'shouzhuo', buy: 0, sell: 38 },
        { id: 'zhenzhu',  buy: 0, sell: 28 },
        { id: 'renshen',  buy: 0, sell: 35 },
        { id: 'lingzhi',  buy: 0, sell: 28 }
      ]
    },
    // 郊野遇上的游方行商（v20260905a）：货随担走，货色少于城中，价略高；
    //   主要价值是把荒野采集/猎获物（草药/矿石/木头/野果/毛皮/蛇胆…）就地换成盘缠。
    field_trader: {
      name: '游方行商',
      items: [
        // —— 货架（buy>0）：行脚随身贩售，聊作远途之便 ——
        { id: 'roubao',      buy: 12, sell: 4  },
        { id: 'jinchuang',   buy: 34, sell: 12 },
        { id: 'yaofen',      buy: 20, sell: 7  },
        { id: 'campfire',    buy: 15, sell: 5  },
        { id: 'sleepmat',    buy: 24, sell: 8  },
        // —— 收售（buy:0 仅寄售不上架）：野外所得就地脱手 ——
        { id: 'caoyao',      buy: 0,  sell: 2  },
        { id: 'tiekuangshi', buy: 0,  sell: 6  },
        { id: 'mutou',       buy: 0,  sell: 3  },
        { id: 'xiaoshuzhi',  buy: 0,  sell: 1  },
        { id: 'yeguo',       buy: 0,  sell: 2  },
        { id: 'shengrou',    buy: 0,  sell: 4  },
        { id: 'maopi',       buy: 0,  sell: 6  },
        { id: 'shedan',      buy: 0,  sell: 10 },
        { id: 'shepi',       buy: 0,  sell: 8  },
        { id: 'xiang',       buy: 0,  sell: 2  },
        // —— 新物品（v20260927t）：野外可得的蛋肉奶蜜 / 药材就地收售 ——
        { id: 'jidan',      buy: 0, sell: 1 },
        { id: 'niunai',     buy: 0, sell: 2 },
        { id: 'yangmao',    buy: 0, sell: 4 },
        { id: 'fengmi',     buy: 0, sell: 7 },
        { id: 'zhurou',     buy: 0, sell: 4 },
        { id: 'yangrou',    buy: 0, sell: 5 },
        { id: 'jirou',      buy: 0, sell: 4 },
        { id: 'niurou',     buy: 0, sell: 6 },
        { id: 'renshen',    buy: 0, sell: 30 },
        { id: 'lingzhi',    buy: 0, sell: 25 },
        // —— 家具（v20260928h）：摆入宅院（床/桌/椅/柜）——
        { id: 'jiaju_chuang', buy: 40, sell: 16 },
        { id: 'jiaju_zhuo',   buy: 26, sell: 10 },
        { id: 'jiaju_yi',     buy: 18, sell: 7  },
        { id: 'jiaju_gui',    buy: 30, sell: 12 },
        // —— 房契保底（v20260928h）：两都宅契亦有售（牙行为主，杂货为便）——
        { id: 'fangqi_luoyang', buy: 120, sell: 60 },
        { id: 'fangqi_changan', buy: 110, sell: 55 }
      ]
    },
    // —— 马行（v20260928h）：坐骑/鞍具/草料上架，活畜高价收 ——
    maxing: {
      name: '马行',
      items: [
        { id: 'ma',      buy: 160, sell: 70 },
        { id: 'lu',      buy: 60,  sell: 25 },
        { id: 'maan',    buy: 30,  sell: 12 },
        { id: 'macao',   buy: 8,   sell: 3  },
        { id: 'xiaoniu', buy: 0,   sell: 35 },
        { id: 'xiaozhu', buy: 0,   sell: 14 },
        { id: 'xiaoyang',buy: 0,   sell: 18 },
        { id: 'xiaoji',  buy: 0,   sell: 6  }
      ]
    },
    // —— 牙行（v20260928h）：卖主城房契，凭契置业；旧宅亦可交还牙行 ——
    yahang: {
      name: '牙行',
      items: [
        { id: 'fangqi_luoyang',  buy: 120, sell: 60 },
        { id: 'fangqi_changan',  buy: 110, sell: 55 },
        { id: 'fangqi_jianye',   buy: 100, sell: 50 },
        { id: 'fangqi_yecheng',  buy: 95,  sell: 48 },
        { id: 'fangqi_wuchang',  buy: 92,  sell: 46 },
        { id: 'fangqi_chengdu',  buy: 90,  sell: 45 },
        { id: 'fangqi_xiangyang',buy: 88,  sell: 44 },
        { id: 'fangqi_linzi',    buy: 85,  sell: 42 },
        { id: 'fangqi_puyang',   buy: 80,  sell: 40 },
        { id: 'fangqi_changsha', buy: 75,  sell: 38 }
      ]
    }
  };
})();
