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
    # 连走 南 出去（牢房→走廊→院子）
    for step in range(5):
        r=ev(page, "() => { try{ window.move('南'); return window.getState().room; }catch(e){ return 'ERR:'+e.message; } }")
        print('MOVE', step, r)
        page.wait_for_timeout(800)
        if str(r).startswith('camp_') and r!='camp_tz1':
            # 若到了营地院子（camp_yard），停
            break
    room=ev(page, "() => window.getState().room")
    print('ROOM NOW:', room)
    # dump 场景按钮图标
    acts = ev(page, """() => {
        var btns=[...document.querySelectorAll('#actions .act')];
        return JSON.stringify(btns.map(function(x){
            var img=x.querySelector('img'); return {name:x.textContent.trim().slice(0,6), src: img? img.getAttribute('src'):'no-img'};
        }).slice(0,40));
    }""")
    print('ACTS:', acts)
    page.screenshot(path=f'{OUT}/scene_yard.png', timeout=8000, animations='disabled')
    b.close()
print('DONE')
