// 模块 sect（从 engine.js 拆分）：门派面板与加入逻辑
(function (global) {
  global.LF = global.LF || {};
  global.LF.createSect = function (ctx) {
    var getState = ctx.getState, S = getState;
    var G = ctx.G;
    var log = ctx.log;
    var toast = ctx.toast;
    var openModal = ctx.openModal;
    var renderStatus = ctx.renderStatus;
    function sectBonusText(b){
      if(!b) return '';
      var m={atk:'攻',def:'防',maxHp:'气血',maxMp:'内力',spd:'身法'};
      var p=[]; Object.keys(b).forEach(function(k){ if(b[k]) p.push('+'+b[k]+' '+m[k]); });
      return p.join(' · ');
    }
    function sectReqText(d){
      var u=d.unlock||{}, p=[];
      if(u.reputation) p.push('江湖声望≥'+u.reputation);
      if(u.level) p.push('等级≥'+u.level);
      if(u.flag) p.push('需先触发「'+(({met_zhangjiao:'张角之遇'})[u.flag]||u.flag)+'」');
      return p.length?p.join(' · '):'无门槛';
    }
    function renderSectPanel(){
      if(!G.SECTS) return '<h3>门 派</h3><p class="tip">数据未载入。</p>';
      var h='<h3>门 派</h3>'+
        '<p class="tip">门派为「中后期可选玩法」：声望初立后方可主动加入，得门风加成与传功。已入者不可更易。</p>'+
        '<div class="sect-list">';
      Object.keys(G.SECTS).forEach(function(id){
        var d=G.SECTS[id], joined=S().sect===id, can=G.canJoinSect(S(),id);
        h+='<div class="sect'+(joined?' on':'')+'">'+
          '<div class="sect-name">'+d.name+'<span class="sect-fac">'+d.faction+'</span></div>'+
          '<div class="sect-desc">'+d.style+'</div>'+
          '<div class="sect-bonus">门风加成 · '+sectBonusText(d.bonus)+'</div>'+
          '<div class="sect-skill">传功 · '+((d.martials||[]).join('、'))+'</div>'+
          '<div class="sect-req">加入条件 · '+sectReqText(d)+'</div>'+
          (joined?'<div class="sect-joined">✓ 已身属此派</div>'
                 :(can.ok?'<button class="sect-join" data-sect="'+id+'">加 入 此 派</button>'
                         :'<button class="sect-join" disabled title="'+can.reason+'">未达条件</button>'))+
          '</div>';
      });
      h+='</div>';
      return h;
    }
    function bindSectPanel(){
      document.querySelectorAll('.sect-join[data-sect]').forEach(function(b){
        if(b.disabled) return;
        b.onclick=function(){
          var id=b.getAttribute('data-sect');
          if(S().sect){ toast('你已身属「'+G.SECTS[S().sect].name+'」'); return; }
          var r=G.canJoinSect(S(),id);
          if(!r.ok){ toast(r.reason); return; }
          G.joinSect(S(),id);
          log('你拜入「'+G.SECTS[id].name+'」，得传功心法。','good');
          toast('已加入「'+G.SECTS[id].name+'」');
          openModal('sect'); renderStatus();
        };
      });
    }
    return {
      sectBonusText, sectReqText, renderSectPanel, bindSectPanel
    };
  };
})(typeof window !== 'undefined' ? window : global);
