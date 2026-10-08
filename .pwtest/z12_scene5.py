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
    page.wait_for_timeout(400)
    # dump 当前 actions 按钮
    def dump_actions(tag):
        r = ev(page, """() => {
            var btns=[...document.querySelectorAll('#actions .act')];
            return JSON.stringify(btns.map(function(x){
                var img=x.querySelector('img'); return {name:x.textContent.trim().slice(0,8), src: img? img.getAttribute('src'):'no-img'};
            }).slice(0,30));
        }""")
        print(tag, r)
    dump_actions('TZ1:')
    # 点第一个按钮（牢门→外出）
    ev(page, "() => { var b=[...document.querySelectorAll('#actions .act')].find(x=>/牢门/.test(x.textContent||'')); if(b){ b.click(); return 'ok'; } return 'no'; }")
    page.wait_for_timeout(700)
    ev(page, "() => { var m=document.querySelector('.obj-menu, #obj-menu'); if(m && getComputedStyle(m).display!=='none'){ var b=[...m.querySelectorAll('button')].find(x=>/出|离开|门|牢/.test(x.textContent||'')) || m.querySelector('button'); if(b){ b.click(); return 'menu:'+b.textContent.trim(); } return 'no-b'; } return 'no-menu'; }")
    page.wait_for_timeout(900)
    dump_actions('YARD:')
    ev(page, "() => { var m=document.querySelector('.obj-menu, #obj-menu'); if(m && getComputedStyle(m).display!=='none'){ var b=[...m.querySelectorAll('button')].find(x=>/出|离开|门|牢/.test(x.textContent||'')) || m.querySelector('button'); if(b){ b.click(); return 'menu2:'+b.textContent.trim(); } return 'no-b'; } return 'no-menu'; }")
    page.wait_for_timeout(900)
    dump_actions('YARD2:')
    page.screenshot(path=f'{OUT}/yard.png', timeout=8000, animations='disabled')
    b.close()
print('DONE')
