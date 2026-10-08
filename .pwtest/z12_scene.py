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
    # 关叙事
    ev(page, "() => { var n=document.getElementById('narr'); if(n) n.style.display='none'; }")
    # 查当前房间 features 里有哪些对象名
    roominfo = ev(page, """() => {
        var S=window.LF.Core.state; var R=window.LF.ROOMS && window.LF.ROOMS[S.room];
        return JSON.stringify({room:S.room, has: R? Object.keys(R.features||{}).length : -1, featNames: R && R.features ? Object.keys(R.features).slice(0,20) : []});
    }""")
    print('ROOM-INFO:', roominfo)
    # 直接调用 enterBldRoom 进药铺
    r=ev(page, "() => { try{ if(window.enterBldRoom){ window.enterBldRoom('yaofu',{kind:'city',cid:window.LF.Core.state.room,x:0,y:0}); return 'ok'; } return 'no enterBldRoom'; }catch(e){ return 'ERR:'+e.message; } }")
    print('ENTER:', r)
    page.wait_for_timeout(1000)
    infos = ev(page, """() => {
        var S=window.LF.Core.state; var R=window.LF.ROOMS && window.LF.ROOMS[S.room];
        var imgs=[...document.querySelectorAll('#actions img.ui-pic, .act img.ui-pic')].map(i=>i.getAttribute('src'));
        return JSON.stringify({room:S.room, featNames: R && R.features ? Object.keys(R.features).slice(0,25) : [], imgs: imgs.slice(0,20)});
    }""")
    print('SCENE-INFO:', infos)
    page.screenshot(path=f'{OUT}/scene_yaofu.png', timeout=8000, animations='disabled')
    b.close()
print('DONE')
