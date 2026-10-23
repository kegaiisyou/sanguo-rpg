#!/usr/bin/env python3
# v20261018e 验证：装配（经 char 面板）后进演武场战斗，战斗卡不再被异步 renderRoom 覆盖；
# 战斗可打完 → 结算 → 确认回地图。用：python3 arena_fix_test.py
import time
from playwright.sync_api import sync_playwright
CHROME = "/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome"
URL = "http://localhost:8897/index.html"
def js(pg, code): return pg.evaluate(code)
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path=CHROME)
    pg = b.new_page(viewport={"width":390,"height":844})
    errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL)
    for _ in range(6):
        js(pg, "(function(){var s=document.querySelector('#pr-skip'); if(s) s.click();})()"); time.sleep(0.3)
    js(pg, "(function(){var t=document.querySelector('#t-start'); if(t) t.click();})()"); time.sleep(0.5)
    js(pg, "(function(){var s=document.querySelector('.slot[data-slot=\"1\"]'); if(s) s.click();})()"); time.sleep(0.5)
    js(pg, "(function(){var s=document.querySelector('#cr-skip'); if(s) s.click();})()"); time.sleep(0.2)
    js(pg, "(function(){var g=document.querySelector('#cr-go'); if(g) g.click();})()"); time.sleep(1.2)
    js(pg, "(function(){var s=window.LF&&window.LF.Core&&window.LF.Core.state; if(s&&s.flags&&s.flags.onb){s.flags.onb.tcDone=true;s.flags.onb.tcTutorial=false;} var pr=document.getElementById('prologue'); if(pr) pr.style.display='none';})()")
    js(pg, "window.openModal('dev')"); time.sleep(0.8)
    js(pg, "(function(){var b=document.querySelector('[data-act=\"martial_tie_shan_kao\"]'); if(b&&b.onclick) b.onclick();})()"); time.sleep(0.4)
    js(pg, "window.closeModal()"); time.sleep(0.3)
    js(pg, "window.openModal('char')"); time.sleep(0.7)
    js(pg, "(function(){var d=document.querySelector('.ch-tab[data-tab=\"skill\"]'); if(d) d.click(); else {var t=[...document.querySelectorAll('.ch-tab')].find(function(x){return x.innerText.indexOf('技能')>=0}); if(t) t.click();}})()")
    time.sleep(0.7)
    js(pg, "(function(){var b=document.querySelector('[data-eq=\"tie_shan_kao\"]'); if(b) b.click();})()"); time.sleep(0.4)
    js(pg, "window.closeModal()"); time.sleep(0.4)
    js(pg, "window.openModal('dev')"); time.sleep(0.7)
    js(pg, "(function(){var b=document.querySelector('[data-act=\"arena\"]'); if(b&&b.onclick) b.onclick();})()"); time.sleep(0.6)
    js(pg, "(function(){var b=document.querySelector('[data-act^=\"arena_\"]'); if(b&&b.onclick) b.onclick();})()"); time.sleep(0.2)
    time.sleep(3.5)  # 越过此前 ~3.2s 的战斗卡被移除窗口
    st = js(pg, "(function(){var c=document.getElementById('dq-combat-card'); return {inDom: !!(c&&c.parentNode), field: !!(c&&c.querySelector('.dq-field')), body: document.body.className.indexOf('in-combat')>=0};})()")
    ok1 = st['inDom'] and st['field'] and st['body']
    print("1. 装配后进战斗·越过bug窗口: 战斗卡保持 =", ok1, st)
    js(pg, "(function(){var s=window.LF&&window.LF.Core&&window.LF.CombatEngine; if(s&&s.state&&s.state.enemies){ s.state.enemies.forEach(function(e){ e.hp=5; }); }})()")
    js(pg, "(function(){var c=document.getElementById('dq-combat-card'); if(c){ var h=[...c.querySelectorAll('.dq-hpv')]; h.forEach(function(x){ x.textContent='5 / '+(x.textContent.split('/')[1]||'0').trim(); }); }})()")
    for _ in range(2):
        js(pg, "(function(){var bs=[...document.querySelectorAll('#actions .act, #actions button')]; var atk=bs.find(function(x){return x.innerText.indexOf('出招')>=0}); if(atk&&atk.onclick) atk.onclick();})()")
        time.sleep(0.3)
        js(pg, "(function(){var a=document.querySelector('#actions'); var x=[...a.querySelectorAll('.act.skill')].find(function(y){return y.innerText.indexOf('普通攻击')>=0}); if(x) x.click();})()")
        time.sleep(0.6)  # 单敌免选目标：选招即打
    time.sleep(2.5)
    settle = js(pg, "!!document.getElementById('combat-settle')")
    ok2 = settle
    print("2. 击杀后结算面板:", ok2)
    ok3 = False
    if settle:
        js(pg, "(function(){var c=document.querySelector('#combat-settle .cs-confirm, #combat-settle button'); if(c) c.click();})()")
        time.sleep(1.5)
        st2 = js(pg, "(function(){return {card: !!(document.getElementById('dq-combat-card')&&document.getElementById('dq-combat-card').parentNode), body: document.body.className.indexOf('in-combat')>=0, acts: (function(){var a=document.getElementById('actions'); return a?a.innerText.slice(0,14).replace('\\n',' '):'noA';})()};})()")
        ok3 = (not st2['card']) and (not st2['body']) and ('军府' in st2['acts'] or '董卓' in st2['acts'])
        print("3. 结算确认回地图:", ok3, st2)
    print("JS错误:", errs if errs else "无")
    print("结果:", "PASS" if (ok1 and ok2 and ok3) else "FAIL")
    b.close()
