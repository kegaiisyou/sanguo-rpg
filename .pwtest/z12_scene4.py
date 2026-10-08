# -*- coding: utf-8 -*-
import sys
sys.path.insert(0, '/home/user/Doubao/chats/38441852029806082/.pwtest')
from playwright.sync_api import sync_playwright
CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
def ev(page, js):
    try: return page.evaluate(js)
    except Exception as e: return 'ERR:'+str(e)[:200]
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
    # 全量找 药柜 出现在哪个对象
    find = ev(page, """() => {
        var keys=Object.keys(window.LF.ROOMS||{});
        var hits=[];
        keys.slice(0,2000).forEach(function(rid){
            var r=window.LF.ROOMS[rid]; if(!r) return;
            var feats=r.features;
            if(!feats) return;
            var arr = Array.isArray(feats)? feats : Object.keys(feats).map(function(k){return feats[k];});
            arr.forEach(function(o){
                if(o && typeof o==='object' && (o.name==='药柜'||o.name==='灶台'||o.name==='熔炉')){
                    hits.push(rid+':'+o.name);
                }
            });
        });
        return JSON.stringify(hits.slice(0,15));
    }""")
    print('HITS2:', find)
    b.close()
print('DONE')
