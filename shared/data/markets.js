// 市集名称样本库 + 商铺招牌生成器（v20260825d）
// 命名法参考汉魏三国史料：商业区称“市”，非“坊”（坊为住宅里坊，北魏隋唐方成体系）。
//   · 长安九市：东市、西市、南市、北市、柳市、直市、交门市、孝里市、交道亭市（《三辅黄图》《长安志》）
//   · 洛阳：金市（宫西大市）、马市、羊市（《洛阳伽蓝记》《太平御览》）
//   · 木兰诗“东市买骏马，西市买鞍鞯”——按方位设多市之例
// 市场名可单一（方位/交易物/地理/祝福），亦可混合（方位+交易物+祝福）。
(function(global){
  global.LF = global.LF || {};
  var LF = global.LF;

  // 方位（由市场格相对城心的罗盘位置推得）
  var DIRECTION = ['东','西','南','北','中'];

  // 交易物后缀：商铺类型 → 市名用字（承汉代“马市/羊市/药市”以货命名之俗）
  var TRADE_CHAR = { yaofu:'药', buzhuang:'布', shishi:'食', zahuo:'货', gongzao:'匠' };

  // 地理类名（可单一使用）。前段为史料实名，后段为 plausible 水陆地名（河/津/渡/桥/关），贴合“长龙河市”一类
  var GEO = ['柳市','直市','金市','交门市','孝里市','交道亭市','长龙河市','渭滨市','洛滨市','津门市','渡口市','桥头市','河市','城关市','陆河市','安阳市'];

  // 吉语/祝福（前置成“永康药市”“忠孝市”“富贵市”）
  var BLESSING = ['永康','忠孝','富贵','太平','安乐','隆兴','大庆','元和','咸宁','嘉禾','广利','通济','阜通','瑞应','归义','靖安'];

  // 字号池（程序生成招牌：字号 + 行业字）
  var ZIHAO = ['济世','锦绣','悦来','万丰','同仁','回春','广济','德盛','永和','兴隆','瑞蚨','义生','泰和','恒丰','福兴','聚盛','安记','庆余','慎余','萃文','集雅','惠通','鼎丰','裕通'];

  // 行业字（按商铺类型）
  var HANGYE = { yaofu:'药铺', buzhuang:'布庄', shishi:'食肆', zahuo:'杂货铺', gongzao:'营造所' };

  function pick(arr, rnd){ return arr[Math.floor(rnd()*arr.length)]; }

  // 市场名：单一或混合皆可。cid 可后续按城微调地理名池；dir 由格位推得；primaryKey 定交易物字
  function marketName(cid, dir, primaryKey, rnd){
    var trade = TRADE_CHAR[primaryKey] || '';
    // 约三成直接以地理全名成市（单一地理型）
    if(rnd() < 0.30) return pick(GEO, rnd);
    var useDir = rnd() < 0.70;
    var useTrade = trade && rnd() < 0.60;
    var useBless = rnd() < 0.35;
    var parts = [];
    if(useBless) parts.push(pick(BLESSING, rnd));
    if(useDir) parts.push(dir);
    if(useTrade) parts.push(trade);
    if(parts.length === 0){
      if(trade) parts.push(trade);
      else parts.push(pick(DIRECTION, rnd));
    }
    return parts.join('') + '市';
  }

  // 招牌：字号 + 行业字（程序生成变体；taken 保证同一市场内不重名）
  function sign(shopKey, rnd, taken){
    taken = taken || {};
    var hang = HANGYE[shopKey] || '商铺';
    var z, i = 0;
    do { z = pick(ZIHAO, rnd); i++; } while(taken[z+hang] && i < 12);
    taken[z+hang] = 1;
    return z + hang;
  }

  LF.MARKETS = {
    DIRECTION:DIRECTION, TRADE_CHAR:TRADE_CHAR, GEO:GEO, BLESSING:BLESSING, ZIHAO:ZIHAO, HANGYE:HANGYE,
    marketName:marketName, sign:sign
  };
  if(typeof module!=='undefined' && module.exports) module.exports = LF.MARKETS;
})(typeof window!=='undefined'?window:globalThis);
