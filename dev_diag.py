#!/usr/bin/env python3
import time
from playwright.sync_api import sync_playwright
CHROME = "/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome"
URL = "http://localhost:8897/index.html"
def js(page, code): return page.evaluate(code)
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path=CHROME)
    pg = b.new_page(viewport={"width": 390, "height": 844})
    msgs = []
    pg.on("pageerror", lambda e: msgs.append("PAGEERROR: " + str(e)))
    pg.goto(URL)
    for _ in range(6):
        js(pg, "(function(){var s=document.querySelector('#pr-skip'); if(s) s.click();})()")
        time.sleep(0.3)
    js(pg, "(function(){var t=document.querySelector('#t-start'); if(t) t.click();})()")
    time.sleep(0.5)
    js(pg, "(function(){var s=document.querySelector('.slot[data-slot=\"1\"]'); if(s) s.click();})()")
    time.sleep(0.5)
    js(pg, "(function(){var s=document.querySelector('#cr-skip'); if(s) s.click();})()")
    time.sleep(0.2)
    js(pg, "(function(){var g=document.querySelector('#cr-go'); if(g) g.click();})()")
    time.sleep(1.0)
    # 直接 openModal
    js(pg, "window.openModal ? openModal('dev') : null")
    time.sleep(0.8)
    st = js(pg, "(function(){var b=document.querySelector('[data-act=\"martial_tie_shan_kao\"]'); if(!b) return {none:true}; return {hasOnclick: !!b.onclick, txt:b.innerText, cls:b.className, modalOpen: [...document.querySelectorAll('.modal')].filter(function(x){return x.className.indexOf('hidden')<0}).length};})()")
    print("打开后按钮:", st)
    # 直接调 onclick
    js(pg, "(function(){var b=document.querySelector('[data-act=\"martial_tie_shan_kao\"]'); if(b && b.onclick) b.onclick();})()")
    time.sleep(0.8)
    after = js(pg, "(function(){var b=document.querySelector('[data-act=\"martial_tie_shan_kao\"]'); return b? {txt:b.innerText, cls:b.className} : 'gone';})()")
    print("点击后:", after)
    # 主日志区
    log = js(pg, "(function(){var l=document.querySelector('.log-area, #log, .log'); return l? l.innerText.slice(-150) : 'no-log-dom';})()")
    print("日志:", log[-120:] if log != 'no-log-dom' else log)
    print("错误:", msgs if msgs else "无")
    b.close()
