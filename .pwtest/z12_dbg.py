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
    page.wait_for_timeout(3000)
    shot0 = ev(page, "() => { var l=document.getElementById('loading'); return l? getComputedStyle(l).display : 'no'; }")
    print('loading display:', shot0)
    page.screenshot(path='/home/user/Doubao/chats/38441852029806082/sanguo-rpg/.pwtest/z12_dbg0.png')

    r = ev(page, "() => { var b=document.getElementById('t-start'); if(b){ b.click(); return 'clicked t-start'; } return 'no t-start'; }")
    print(r)
    page.wait_for_timeout(2000)
    r2 = ev(page, "() => { var p=document.getElementById('prologue'); return p? getComputedStyle(p).display : 'no prologue'; }")
    print('prologue display:', r2)
    r3 = ev(page, "() => { var s=document.querySelector('.slot[data-slot=\"1\"], .slot[data-mode=\"new\"]'); if(s){ s.click(); return 'clicked slot1'; } return 'no slot'; }")
    print(r3)
    page.wait_for_timeout(1200)
    st = ev(page, "() => JSON.stringify({saved: !!window.S, room: window.state && window.state.room, sceneTxt: (document.getElementById('scene')||{}).textContent ? document.getElementById('scene').textContent.slice(0,60) : ''})")
    print('STATE:', st)
    page.screenshot(path='/home/user/Doubao/chats/38441852029806082/sanguo-rpg/.pwtest/z12_dbg1.png')
    b.close()
print('DONE')
