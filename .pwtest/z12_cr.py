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
    page.wait_for_timeout(1200)
    # 列出 newgame 面板 slot
    slots = ev(page, "() => [...document.querySelectorAll('.slot[data-mode]')].map(s=>({mode:s.getAttribute('data-mode'), slot:s.getAttribute('data-slot')}))")
    print('SLOTS:', slots)
    # 点第一个 new
    ev(page, "() => { var s=document.querySelector('.slot[data-mode=\"new\"]'); if(s){ s.click(); return 'ok'; } return 'none'; }")
    page.wait_for_timeout(900)
    btns = ev(page, "() => [...document.querySelectorAll('#modal button, .modal button')].map(b=>b.textContent.trim().slice(0,12)).slice(0,30)")
    print('MODAL-BTNS:', btns)
    page.screenshot(path='/home/user/Doubao/chats/38441852029806082/sanguo-rpg/.pwtest/z12_cr.png')
    b.close()
print('DONE')
