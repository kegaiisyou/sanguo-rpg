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
    page.wait_for_timeout(700)
    r=ev(page, "() => { var b=[...document.querySelectorAll('#modal button,.modal button')].find(x=>/江湖/.test(x.textContent||'')); if(b){ b.click(); return 'clicked:'+b.textContent.trim(); } return 'no-btn'; }")
    print('CONFIRM:', r)
    page.wait_for_timeout(2000)
    st=ev(page, "() => JSON.stringify({app: (function(){var a=document.getElementById('app'); return a? getComputedStyle(a).display:'none';})(), pro: (function(){var p=document.getElementById('prologue'); return p? getComputedStyle(p).display:'none';})(), narr: (document.getElementById('narr')||{}).textContent ? document.getElementById('narr').textContent.slice(0,50):'', modal: (function(){var m=document.getElementById('modal'); return m? getComputedStyle(m).display:'none';})(), cr: document.querySelector('#modal .cr-head,#modal #cr-head') ? 'create-ui-open' : 'no-create-ui'})")
    print('STATE:', st)
    page.screenshot(path='/home/user/Doubao/chats/38441852029806082/sanguo-rpg/.pwtest/z12_dbg2.png')
    b.close()
print('DONE')
