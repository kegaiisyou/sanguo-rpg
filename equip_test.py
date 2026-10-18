#!/usr/bin/env python3
# v20261018c 完整验证：调试台武学 + 装配系统 + 铁拳（onclick 直调，最稳）
import time
from playwright.sync_api import sync_playwright
CHROME = "/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome"
URL = "http://localhost:8897/index.html"
def js(page, code): return page.evaluate(code)
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path=CHROME)
    pg = b.new_page(viewport={"width": 390, "height": 844})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
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

    # 1. 调试台武学按钮
    js(pg, "window.openModal ? openModal('dev') : null")
    time.sleep(0.8)
    n = js(pg, "document.querySelectorAll('[data-act^=\"martial_\"]').length")
    print("1. 调试台武学按钮数:", n, "(期望42)")

    # 2. 逐门习得 4 门（逐步打印）
    for mid in ["martial_tie_quan", "martial_tie_shan_kao", "martial_lian_zhu_jian", "martial_tian_lie_di_chui", "martial_yang_qi_jue"]:
        js(pg, f"(function(){{var b=document.querySelector('[data-act=\"{mid}\"]'); if(b&&b.onclick) b.onclick();}})()")
        time.sleep(0.4)
        nn = js(pg, "document.querySelectorAll('[data-act^=\"martial_\"]').length")
        head = js(pg, "(function(){var c=document.querySelector('#modal-card'); return c? c.innerHTML.slice(0,100) : 'nocard';})()")
        print(f"   点击{mid}后按钮数={nn} modal-card头={head}")
    owned = js(pg, "[...document.querySelectorAll('[data-act^=\"martial_\"]')].filter(function(x){return x.className.indexOf('dev-owned')>=0}).length")
    print("2. 已习得标记数:", owned, "(期望≥4)")
    # 养气诀为发力→已装配
    yq = js(pg, "(function(){var b=document.querySelector('[data-act=\"martial_yang_qi_jue\"]'); return b? b.innerText : '';})()")
    print("   养气诀按钮:", yq)

    # 3. 武学录装配：打开角色详情 → 技能tab
    js(pg, "window.closeModal ? closeModal() : null")
    time.sleep(0.3)
    js(pg, "window.openModal ? openModal('char') : null")
    time.sleep(0.7)
    js(pg, "(function(){var d=document.querySelector('.ch-tab[data-tab=\"skill\"]'); if(d) d.click(); else {var t=[...document.querySelectorAll('.ch-tab')].find(function(x){return x.innerText.indexOf('技能')>=0}); if(t) t.click();}})()")
    time.sleep(0.7)
    cards = js(pg, "(function(){var v=document.querySelector('#m-skill-view'); return v? v.querySelectorAll('.ma-card').length : -1;})()")
    head = js(pg, "(function(){var v=document.querySelector('#m-skill-view'); return v? v.innerText.slice(0,46) : '';})()")
    print("3. 武学录卡片:", cards, "(期望5) 头部:", head.replace('\\n',' '))

    # 4. 装配：铁山靠+连珠箭（崩拳已装）→ 天裂地锤被拦
    for mid in ["tie_shan_kao", "lian_zhu_jian", "tian_lie_di_chui"]:
        js(pg, f"(function(){{var b=document.querySelector('[data-eq=\"{mid}\"]'); if(b) b.click();}})()")
        time.sleep(0.4)
    eqc = js(pg, "(function(){var v=document.querySelector('#m-skill-view'); return v? v.querySelectorAll('.ma-card.eq').length : -1;})()")
    eqtxt = js(pg, "(function(){var v=document.querySelector('#m-skill-view'); if(!v) return ''; var b=v.querySelector('.ma-card.eq .ma-eq'); return b? b.innerText : '';})()")
    print("4. 装配高亮:", eqc, "(期望3, 天裂被拦) · 装配按钮文字:", eqtxt)
    savechk4 = js(pg, "(function(){try{var s=JSON.parse(localStorage.getItem('lf_save_1')); return {eq:s.equippedMartial, learned:s.learnedMartial.length};}catch(e){return 'err:'+e;}})()")
    print("   装配后存档:", savechk4)
    mem = js(pg, "(function(){var s=window.LF && window.LF.Core && window.LF.Core.state; return s? {eq:s.equippedMartial, learned:s.learnedMartial} : 'no-core';})()")
    print("   内存装配状态:", mem)
    # 卸下再验证
    js(pg, "(function(){var b=document.querySelector('[data-eq=\"lian_zhu_jian\"]'); if(b&&b.onclick) b.onclick();})()")
    time.sleep(0.4)
    eqc2 = js(pg, "(function(){var v=document.querySelector('#m-skill-view'); return v? v.querySelectorAll('.ma-card.eq').length : -1;})()")
    print("   卸下连珠箭后:", eqc2, "(期望2)")

    # 5. 铁拳详情（1.2x / +15%）
    js(pg, "(function(){var c=document.querySelector('.ma-card[data-mid=\"tie_quan\"] .ma-main'); if(c) c.click();})()")
    time.sleep(0.5)
    txt = js(pg, "(function(){var d=document.querySelector('.ma-detail'); return d? d.innerText : '';})()")
    print("5. 铁拳详情含 1.2x:", "1.2x" in txt or "1.2×" in txt, "· 伤害+15%:", "伤害+15%" in txt, "· 文本片段:", txt[txt.find('威力'):txt.find('威力')+30] if '威力' in txt else '无威力字段')

    # 6. 战斗选招 = 装配优先（崩拳+铁山靠+连珠箭）
    js(pg, "window.closeModal ? closeModal() : null")
    time.sleep(0.3)
    js(pg, "window.openModal ? openModal('dev') : null")
    time.sleep(0.6)
    js(pg, "(function(){var b=document.querySelector('[data-act=\"arena\"]'); if(b&&b.onclick) b.onclick();})()")
    time.sleep(0.7)
    # 点第一个敌人（camp_dummy）
    js(pg, "(function(){var b=document.querySelector('[data-act^=\"arena_\"]'); if(b&&b.onclick) b.onclick();})()")
    time.sleep(1.2)
    js(pg, "(function(){var bs=[...document.querySelectorAll('#actions .act, #actions button')]; var wu=bs.find(function(x){return x.innerText.indexOf('武学')>=0}); if(wu&&wu.onclick) wu.onclick();})()")
    time.sleep(0.5)
    arts = js(pg, "(function(){var a=document.querySelector('#actions'); if(!a) return null; return [...a.querySelectorAll('.act.skill')].map(function(x){return x.innerText});})()")
    print("6. 战斗选招:", arts)
    savechk = js(pg, "(function(){try{var s=JSON.parse(localStorage.getItem('lf_save_1')); return {eq:s.equippedMartial, learned:s.learnedMartial.length};}catch(e){return 'err:'+e;}})()")
    print("   存档检查:", savechk)
    pg.screenshot(path="equip_shot.png")
    print("截图: equip_shot.png")
    print("JS错误:", errs if errs else "无")
    b.close()
