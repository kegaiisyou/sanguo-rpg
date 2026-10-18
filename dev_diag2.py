#!/usr/bin/env python3
import time
from playwright.sync_api import sync_playwright
CHROME = "/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome"
URL = "http://localhost:8897/index.html"
def js(page, code): return page.evaluate(code)
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path=CHROME)
    pg = b.new_page(viewport={"width": 390, "height": 844})
    errs = []
    cons = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: cons.append(m.type + ": " + m.text))
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
    js(pg, "window.openModal ? openModal('dev') : null")
    time.sleep(0.8)
    print("点击前按钮数:", js(pg, "document.querySelectorAll('[data-act^=\"martial_\"]').length"))
    lf_info = js(pg, "(function(){var ma=window.LF&&window.LF.MARTIAL_ARTS; return {hasMA: !!ma, hasLINES: !!(ma&&ma.LINES), keys: ma? Object.keys(ma).length : 0, lines: ma&&ma.LINES? Object.keys(ma.LINES).length : 0};})()")
    print("LF.MARTIAL_ARTS:", lf_info)
    # 逐个点击并观察
    for mid in ["martial_tie_shan_kao", "martial_lian_zhu_jian", "martial_tian_lie_di_chui", "martial_yang_qi_jue"]:
        js(pg, f"(function(){{try{{var b=document.querySelector('[data-act=\"{mid}\"]'); if(b&&b.onclick) b.onclick();}}catch(e){{window.__dErr=String(e);}}}})()")
        derr = js(pg, "window.__dErr || '无异常'")
        pnl = js(pg, "(function(){var acts=[...document.querySelectorAll('.dev-sec [data-act]')].map(function(x){return x.getAttribute('data-act')}); var mA=acts.filter(function(a){return a.indexOf('martial_')===0}); var arena=acts.filter(function(a){return a.indexOf('arena_')===0}); var all=acts.length; return {all:all, martial:mA.length, arena:arena.length, sample:mA.slice(0,3), hasWu: document.body.innerText.indexOf('🥋')>=0};})()")
        time.sleep(0.4)
        n = js(pg, "document.querySelectorAll('[data-act^=\"martial_\"]').length")
        owned = js(pg, "[...document.querySelectorAll('[data-act^=\"martial_\"]')].filter(function(x){return x.className.indexOf('dev-owned')>=0}).length")
        print(f"点击 {mid} 后: 按钮数={n} 已标记={owned} 异常={derr} 面板={pnl}")
        if n == 0:
            print("  面板DOM:", js(pg, "(function(){return [...document.querySelectorAll('.modal, .panel, #m-dev, [class*=dev]')].map(function(x){return x.className+':'+x.id}).slice(0,10)})()"))
            break
    print("错误:", errs if errs else "无", "console:", cons[-4:] if cons else "无")
    b.close()
