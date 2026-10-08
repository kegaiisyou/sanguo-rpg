# -*- coding: utf-8 -*-
import sys
sys.path.insert(0, '/home/user/Doubao/chats/38441852029806082/.pwtest')
from playwright.sync_api import sync_playwright
CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
def ev(page, js):
    try: return page.evaluate(js)
    except Exception as e: return 'ERR:'+str(e)[:200]
OUT='/home/user/Doubao/chats/38441852029806082/sanguo-rpg/.pwtest/z12v'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width':560,'height':1000}, device_scale_factor=2)
    page = ctx.new_page()
    page.goto('http://127.0.0.1:8199/index.html', wait_until='load', timeout=90000)
    page.wait_for_timeout(2500)
    ev(page, "() => { var b=document.getElementById('t-start'); if(b) b.click(); }")
    page.wait_for_timeout(900)
    ev(page, "() => { var s=document.querySelector('.slot[data-mode=\"new\"]'); if(s) s.click(); }")
    page.wait_for_timeout(600)
    ev(page, "() => { var b=[...document.querySelectorAll('#modal button,.modal button')].find(x=>/踏\\s*入\\s*江\\s*湖/.test(x.textContent||'')); if(b) b.click(); }")
    page.wait_for_timeout(1500)
    for _ in range(6):
        ev(page, "() => { var s=document.getElementById('pr-skip'); if(s && getComputedStyle(s).display!=='none'){ s.click(); return 'sk'; } return 'no'; }")
        page.wait_for_timeout(600)
    page.wait_for_timeout(900)
    ev(page, "() => { var n=document.getElementById('narr'); if(n) n.style.display='none'; }")
    find = ev(page, """() => {
        var targets=['灶台','药柜','捣药罐','炼药台','熬药壶','药炉','木人桩','木作台','砖窑','熔炉','铁料堆','立栅','夯土基','简牍架','香案','钱柜','酒瓮','蒸笼','菜案','织机','染缸','镖旗','马厩','骰盆'];
        var B=window.LF.BUILDINGS || (window.LF.SharedGame && window.LF.SharedGame.BUILDINGS) || (window.LF.Core && window.LF.Core.BUILDINGS);
        var blds = B || (window.LF && window.LF.ROOMS);
        var keys=Object.keys(blds||{});
        var hits=[];
        keys.forEach(function(rid){
            var r=blds[rid]; if(!r || !r.features) return;
            var names=(Array.isArray(r.features)?r.features:Object.keys(r.features).map(function(k){return r.features[k];})).map(function(o){return o&&o.name;}).filter(Boolean);
            var m=names.filter(function(n){ return targets.indexOf(n)>=0; });
            if(m.length) hits.push(rid+' -> '+m.join('/'));
        });
        return JSON.stringify({bldCount:keys.length, hits:hits.slice(0,12)});
    }""")
    print('FIND:', find)
    b.close()
print('DONE')
