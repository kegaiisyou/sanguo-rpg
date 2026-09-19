// 模块 mapking（从 engine.js 拆分）
(function (global) {
  global.LF = global.LF || {};
  global.LF.createMapKing = function (ctx) {
    var getState = ctx.getState, S = getState;
    var LF = ctx.LF;
    var G = ctx.G;
    var mapData = ctx.mapData;
    var resolveMapCoords = ctx.resolveMapCoords;
    var mapKind = ctx.mapKind;
    var curRoom = ctx.curRoom;
    var closeModal = ctx.closeModal;
    var renderRoom = ctx.renderRoom;
    var save = ctx.save;
    var mapNodeInfo = ctx.mapNodeInfo;
  function buildMapKingHTML(opts){
    opts=opts||{};
    var coords=resolveMapCoords();
    var keys=Object.keys(G.ROOMS).filter(function(rid){return coords[rid] && !(G.ROOMS[rid].isField);});
    var KC=110, PAD=46;
    var minc=Infinity,maxc=-Infinity,minr=Infinity,maxr=-Infinity;
    keys.forEach(function(rid){var c=coords[rid];
      if(c[0]<minc)minc=c[0]; if(c[0]>maxc)maxc=c[0]; if(c[1]<minr)minr=c[1]; if(c[1]>maxr)maxr=c[1];
    });
    var W=(maxc-minc+1)*KC+PAD*2, H=(maxr-minr+1)*KC+PAD*2;
    function px(c){ return PAD+(c[0]-minc)*KC; }
    function py(c){ return PAD+(c[1]-minr)*KC; }
    // 区域淡底色（山水区块感，取自 regions 数据，随间距放大）
    var rg='';
    (mapData().regions||[]).forEach(function(r){
      var rr=Math.max(30, Math.round(r.r*KC/46));
      rg+='<div class="mk-region" style="left:'+(px(r.center)-rr)+'px;top:'+(py(r.center)-rr)+'px;width:'+(rr*2)+'px;height:'+(rr*2)+'px;background:'+(r.c||'rgba(140,160,120,.35)')+'"></div>';
    });
    // ── SVG 层：示意河流 + 道路连线（都在 .mk-bg 内，随缩放整体 scale，矢量不模糊）──
    var svg='<svg class="mk-lines" width="'+W+'" height="'+H+'" xmlns="http://www.w3.org/2000/svg">';
    var MK_RIVERS=[
      {name:'黄河',w:4,pts:[[.02,.55],[.10,.48],[.20,.52],[.30,.40],[.42,.46],[.54,.33],[.66,.38],[.78,.28],[.98,.22]]},
      {name:'长江',w:3,pts:[[.02,.92],[.14,.84],[.28,.88],[.42,.80],[.56,.86],[.70,.76],[.84,.82],[.98,.72]]}
    ];
    function smoothRiver(pts){ // 中点二次贝塞尔平滑成蜿蜒河线
      var d='M'+(pts[0][0]*W).toFixed(1)+' '+(pts[0][1]*H).toFixed(1);
      for(var i=1;i<pts.length-1;i++){
        var xc=(((pts[i][0]+pts[i+1][0])/2)*W).toFixed(1), yc=(((pts[i][1]+pts[i+1][1])/2)*H).toFixed(1);
        d+=' Q'+(pts[i][0]*W).toFixed(1)+' '+(pts[i][1]*H).toFixed(1)+' '+xc+' '+yc;
      }
      var lp=pts[pts.length-1];
      d+=' L'+(lp[0]*W).toFixed(1)+' '+(lp[1]*H).toFixed(1);
      return d;
    }
    MK_RIVERS.forEach(function(rv,idx){
      svg+='<path class="mk-river'+(idx>0?' r2':'')+'" d="'+smoothRiver(rv.pts)+'"/>';
      var mp=rv.pts[Math.floor(rv.pts.length/2)];
      svg+='<text class="mk-river-t" x="'+(mp[0]*W).toFixed(1)+'" y="'+(mp[1]*H).toFixed(1)+'">'+rv.name+'</text>';
    });
    var seen={}, lines='';
    function mkPath(c,t){ // 二次贝塞尔曲线：路自然弯曲（弯向由坐标奇偶决定，避免同向堆叠）
      var x1=px(c), y1=py(c), x2=px(t), y2=py(t), dx=x2-x1, dy=y2-y1;
      var mx=(x1+x2)/2, my=(y1+y2)/2;
      var off=Math.min(26, Math.max(14, Math.sqrt(dx*dx+dy*dy)*0.2));
      var s=((c[0]+c[1])&1)?1:-1, cx, cy;
      if(Math.abs(dx)>=Math.abs(dy)){ cx=mx; cy=my+off*s; }
      else { cx=mx+off*s; cy=my; }
      return 'M '+x1+' '+y1+' Q '+Math.round(cx)+' '+Math.round(cy)+' '+x2+' '+y2;
    }
    keys.forEach(function(rid){
      var c=coords[rid], ex=G.ROOMS[rid].exits||{};
      Object.keys(ex).forEach(function(dir){
        var tid=ex[dir]; if(!coords[tid]) return;
        var k=[rid,tid].sort().join('|'); if(seen[k]) return; seen[k]=1;
        var reach=(rid===S().room||tid===S().room);
        lines+='<path class="mk-road'+(reach?' on':'')+'" d="'+mkPath(c,coords[tid])+'"/>';
      });
    });
    svg+=lines+'</svg>';
    // 房间节点（纯文字，无 icon；data-bx/by 存基准像素坐标，缩放时按比例重排保证文字清晰）
    var pins='';
    keys.forEach(function(rid){
      var r=G.ROOMS[rid], kind=mapKind(rid);
      if(kind==='tutorial') return; // 教学关卡不在大地图显示
      var cur=(rid===S().room), spawn=(opts.pickSpawn&&rid===S().spawnRoom);
      var bx=Math.round(px(coords[rid])), by=Math.round(py(coords[rid]));
      pins+='<div class="mk-pin'+(cur?' cur':'')+'"'+(opts.pickSpawn?' data-spawn="'+rid+'"':' data-rid="'+rid+'"')+
        ' data-bx="'+bx+'" data-by="'+by+'" title="'+r.name+'" style="left:'+bx+'px;top:'+by+'px">'+
        (spawn?'<span class="mk-spawn">★</span>':'')+
        '<span class="mk-nm">'+r.name+'</span></div>';
    });
    var title=opts.pickSpawn?'🗺 设置出生点':'山 河 志';
    var tip=opts.pickSpawn
      ? '点击一处地点设为出生点，并立即传送至此（已自动存档）。当前出生点：'+(G.ROOMS[S().spawnRoom]?G.ROOMS[S().spawnRoom].name:S().spawnRoom)
      : '单指拖动查看疆域，双指缩放（按钮/Ctrl+滚轮亦可）。点击任一去处前往（体力-4 · 食物-1 · 饮水-1 · 时间+1刻）。当前位于「'+curRoom().name+'」；已去之处无需再远行。';
    return '<h3>'+title+'</h3>'+
      '<div class="map-king"><div class="map-king-canvas" style="width:'+W+'px;height:'+H+'px">'+
        '<div class="mk-bg">'+rg+svg+'</div>'+pins+'</div></div>'+
      '<div class="mk-bar"><div class="mk-zoom">'+
        '<button id="mk-zoom-out" title="缩小">−</button>'+
        '<button id="mk-zoom-in" title="放大">＋</button>'+
        '<button id="mk-zoom-1" title="恢复原始大小">1:1</button></div>'+
        '<button class="mk-recenter" id="mk-recenter">⌖ 回到当前位置</button></div>'+
      '<p class="tip">'+tip+'</p>';
  }
  function initMapKing(opts){
    opts=opts||{};
    var wrap=document.querySelector('#modal-card .map-king'); if(!wrap) return;
    var canvas=wrap.querySelector('.map-king-canvas');
    var bg=wrap.querySelector('.mk-bg');
    var W0=canvas.offsetWidth, H0=canvas.offsetHeight;
    var SC=1, MIN=0.45, MAX=2.2;
    var baseFs=(document.documentElement.clientWidth<=560)?11.5:12;
    function applyScale(){ // 背景层 scale(矢量不模糊)，节点用 left/top/fontSize 重排（文字清晰）
      canvas.style.width=Math.round(W0*SC)+'px';
      canvas.style.height=Math.round(H0*SC)+'px';
      if(bg) bg.style.transform='scale('+SC+')';
      var fs=Math.max(7, Math.min(16, baseFs*SC));
      wrap.querySelectorAll('.mk-pin').forEach(function(p){
        p.style.left=Math.round(+p.getAttribute('data-bx')*SC)+'px';
        p.style.top=Math.round(+p.getAttribute('data-by')*SC)+'px';
        var nm=p.querySelector('.mk-nm'); if(nm) nm.style.fontSize=fs+'px';
      });
    }
    function setScale(ns,avx,avy){ // 以容器内 (avx,avy) 为锚缩放，保持锚点内容不动
      if(ns<MIN) ns=MIN; if(ns>MAX) ns=MAX;
      if(ns===SC) return;
      var ax=(avx!=null)?avx:wrap.clientWidth/2;
      var ay=(avy!=null)?avy:wrap.clientHeight/2;
      var cx=(wrap.scrollLeft+ax)/SC, cy=(wrap.scrollTop+ay)/SC;
      SC=ns; applyScale();
      wrap.scrollLeft=cx*SC-ax; wrap.scrollTop=cy*SC-ay;
    }
    if(opts.pickSpawn){
      wrap.querySelectorAll('[data-spawn]').forEach(function(el){
        el.addEventListener('click', function(){
          var rid=el.getAttribute('data-spawn');
          S().spawnRoom=rid;
          log('【调试】出生点已设为：'+G.ROOMS[rid].name+'。','good');
          closeModal(); renderRoom(rid); save(S());
        });
      });
    } else {
      wrap.querySelectorAll('[data-rid]').forEach(function(el){
        el.addEventListener('click', function(){
          mapNodeInfo(el.getAttribute('data-rid'));
        });
      });
    }
    // 缩放：按钮 / Ctrl+滚轮 / 双指捏合（单指拖动交给原生滚动）
    var zin=document.getElementById('mk-zoom-in'), zout=document.getElementById('mk-zoom-out'), z1=document.getElementById('mk-zoom-1');
    if(zin) zin.addEventListener('click', function(){ setScale(SC*1.25); });
    if(zout) zout.addEventListener('click', function(){ setScale(SC*0.8); });
    if(z1) z1.addEventListener('click', function(){ setScale(1); });
    wrap.addEventListener('wheel', function(e){
      if(e.ctrlKey){
        e.preventDefault();
        var r=wrap.getBoundingClientRect();
        setScale(SC*(e.deltaY<0?1.12:0.89), e.clientX-r.left, e.clientY-r.top);
      }
    }, {passive:false});
    var ts=null;
    function tdist(t){ var dx=t[0].clientX-t[1].clientX, dy=t[0].clientY-t[1].clientY; return Math.sqrt(dx*dx+dy*dy); }
    wrap.addEventListener('touchstart', function(e){
      ts=(e.touches.length===2)?{d:tdist(e.touches), s:SC}:null;
    }, {passive:true});
    wrap.addEventListener('touchmove', function(e){
      if(ts&&e.touches.length===2){
        e.preventDefault();
        var r=wrap.getBoundingClientRect();
        var mx=(e.touches[0].clientX+e.touches[1].clientX)/2, my=(e.touches[0].clientY+e.touches[1].clientY)/2;
        setScale(ts.s*tdist(e.touches)/ts.d, mx-r.left, my-r.top);
      }
    }, {passive:false});
    wrap.addEventListener('touchend', function(){ ts=null; });
    var rb=document.getElementById('mk-recenter');
    if(rb) rb.addEventListener('click', function(){
      var cur=wrap.querySelector('.mk-pin.cur')||wrap.querySelector('.mk-pin');
      if(cur) cur.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});
    });
    // 初始定位到当前房间（居中）
    var init=wrap.querySelector('.mk-pin.cur')||wrap.querySelector('.mk-pin');
    if(init){ wrap.scrollLeft=Math.max(0, init.offsetLeft-wrap.clientWidth/2); wrap.scrollTop=Math.max(0, init.offsetTop-wrap.clientHeight/2); }
  }
    return {
      buildMapKingHTML, initMapKing
    };
  };
})(typeof window !== 'undefined' ? window : global);
