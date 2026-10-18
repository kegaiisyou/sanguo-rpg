#!/usr/bin/env python3
# v20261018d 验证：上阵栏（类装备栏槽位）+ 多段追击动画
# 说明：经 char 面板装配后再从演武场进战斗存在既有 bug（战斗卡被移除，旧版同样复现），
#       故拆两个会话：会话1 验证上阵栏（char 面板），会话2 验证多段（JS 设装配，不经 char 面板）。
import time
from playwright.sync_api import sync_playwright
CHROME = "/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome"
URL = "http://localhost:8897/index.html"
def js(page, code): return page.evaluate(code)

def open_game(pg):
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
    # 跳过教学战 + 移除序章遮罩
    js(pg, "(function(){var s=window.LF&&window.LF.Core&&window.LF.Core.state; if(s&&s.flags&&s.flags.onb){s.flags.onb.tcDone=true; s.flags.onb.tcTutorial=false;} var pr=document.getElementById('prologue'); if(pr) pr.style.display='none'; var b=document.body; if(b) b.classList.remove('in-combat');})()")
    time.sleep(0.4)

def learn(pg, mids):
    js(pg, "window.openModal ? openModal('dev') : null")
    time.sleep(0.8)
    for mid in mids:
        js(pg, f"(function(){{var b=document.querySelector('[data-act=\"{mid}\"]'); if(b&&b.onclick) b.onclick();}})()")
        time.sleep(0.4)
    js(pg, "window.closeModal ? closeModal() : null")
    time.sleep(0.3)

with sync_playwright() as p:
    # ── 会话1：上阵栏结构 + 卸下 ──
    b1 = p.chromium.launch(headless=True, executable_path=CHROME)
    pg1 = b1.new_page(viewport={"width": 390, "height": 844})
    errs1 = []
    pg1.on("pageerror", lambda e: errs1.append(str(e)))
    pg1.goto(URL)
    open_game(pg1)
    learn(pg1, ["martial_lian_zhu_jian", "martial_tie_shan_kao", "martial_tian_nv_san_hua", "martial_yang_qi_jue"])
    js(pg1, "(function(){var s=window.LF&&window.LF.Core&&window.LF.Core.state; if(s){ s.equippedMartial=['beng_quan','tie_shan_kao','lian_zhu_jian']; s.equippedForce=['yang_qi_jue']; }})()")
    time.sleep(0.3)
    js(pg1, "window.openModal ? openModal('char') : null")
    time.sleep(0.7)
    js(pg1, "(function(){var d=document.querySelector('.ch-tab[data-tab=\"skill\"]'); if(d) d.click(); else {var t=[...document.querySelectorAll('.ch-tab')].find(function(x){return x.innerText.indexOf('技能')>=0}); if(t) t.click();}})()")
    time.sleep(0.7)
    sb = js(pg1, "(function(){var v=document.querySelector('#m-skill-view'); if(!v) return null; "
      "return {bar: !!v.querySelector('.ma-slotbar'), "
      "filled: v.querySelectorAll('.ma-slot.filled').length, "
      "empty: v.querySelectorAll('.ma-slot.empty').length, "
      "force: v.querySelectorAll('.ma-slot.filled.force').length, "
      "head: v.querySelector('.ma-slothead em') ? v.querySelector('.ma-slothead em').innerText : '', "
      "slots: [...v.querySelectorAll('.ma-slot.filled')].map(function(x){return x.innerText.trim().replace(/\\n/g,' ');})};})()")
    print("1. 上阵栏:", sb)
    js(pg1, "(function(){var s=document.querySelector('.ma-slot.filled[data-slot=\"lian_zhu_jian\"]'); if(s) s.click();})()")
    time.sleep(0.4)
    sb2 = js(pg1, "(function(){var v=document.querySelector('#m-skill-view'); if(!v) return null; "
      "return {filled: v.querySelectorAll('.ma-slot.filled').length, empty: v.querySelectorAll('.ma-slot.empty').length, "
      "head: v.querySelector('.ma-slothead em') ? v.querySelector('.ma-slothead em').innerText : ''};})()")
    print("2. 槽位卸下后:", sb2, "(期望 filled=2 empty=1 head=2/3)")
    print("会话1 JS错误:", errs1 if errs1 else "无")
    b1.close()

    # ── 会话2：多段追击动画（不经 char 面板） ──
    b2 = p.chromium.launch(headless=True, executable_path=CHROME)
    pg2 = b2.new_page(viewport={"width": 390, "height": 844})
    errs2 = []
    pg2.on("pageerror", lambda e: errs2.append(str(e)))
    pg2.goto(URL)
    open_game(pg2)
    learn(pg2, ["martial_lian_zhu_jian"])
    js(pg2, "(function(){var s=window.LF&&window.LF.Core&&window.LF.Core.state; if(s){ s.equippedMartial=['beng_quan','lian_zhu_jian']; }})()")
    time.sleep(0.3)
    js(pg2, "window.openModal('dev')")
    time.sleep(0.8)
    js(pg2, "(function(){var b=document.querySelector('[data-act=\"arena\"]'); if(b&&b.onclick) b.onclick();})()")
    time.sleep(0.7)
    arenachk = js(pg2, "(function(){var c=document.getElementById('modal-card'); return c? (c.innerText.indexOf('演武')>=0? '演武场清单' : c.innerText.slice(0,30)) : 'nocard';})()")
    print("   arena面板:", arenachk)
    js(pg2, "(function(){var b=document.querySelector('[data-act^=\"arena_\"]'); if(b&&b.onclick) b.onclick();})()")
    time.sleep(1.5)
    incombat = js(pg2, "document.body.className.indexOf('in-combat')>=0")
    card = js(pg2, "(function(){var c=document.getElementById('dq-combat-card'); return c? 'card-ok' : 'nocard';})()")
    nl = js(pg2, "(function(){var n=document.getElementById('narr'); return n? n.innerText.slice(-120) : '';})()")
    print("   战斗状态:", "已进入" if incombat else "未进入", "· 战斗卡:", card, "· 日志:", nl.replace('\\n',' ')[-80:])
    # 玩家：武学 → 连珠箭 → 目标
    js(pg2, "(function(){var bs=[...document.querySelectorAll('#actions .act, #actions button')]; var wu=bs.find(function(x){return x.innerText.indexOf('武学')>=0}); if(wu&&wu.onclick) wu.onclick();})()")
    time.sleep(0.3)
    act1 = js(pg2, "(function(){var a=document.querySelector('#actions'); return a? a.innerText.slice(0,60) : 'no-actions';})()")
    print("   选招后:", act1.replace('\\n',' ')[:60])
    js(pg2, "(function(){var a=document.querySelector('#actions'); var x=[...a.querySelectorAll('.act.skill')].find(function(y){return y.innerText.indexOf('连珠箭')>=0}); if(x) x.click();})()")
    time.sleep(0.3)
    js(pg2, "(function(){var a=document.querySelector('#actions'); var tgt=[...a.querySelectorAll('.act.cb-menu')].find(function(y){return y.innerText.indexOf('返回')<0;}); if(tgt) tgt.click();})()")
    time.sleep(0.5)
    # 队友：攻击 → 目标
    js(pg2, "(function(){var bs=[...document.querySelectorAll('#actions .act, #actions button')]; var atk=bs.find(function(x){return x.innerText.indexOf('攻击')>=0}); if(atk&&atk.onclick) atk.onclick();})()")
    time.sleep(0.3)
    js(pg2, "(function(){var a=document.querySelector('#actions'); var tgt=[...a.querySelectorAll('.act.cb-menu')].find(function(y){return y.innerText.indexOf('返回')<0;}); if(tgt) tgt.click();})()")
    time.sleep(0.5)
    # 高频采样段演出：飘字共存数（多段时 ≥2）
    peak = 0
    for k in range(60):
        n = js(pg2, "document.querySelectorAll('.dmg-float.side-enemy').length")
        if n > peak: peak = n
        time.sleep(0.06)
    logs = js(pg2, "(function(){var n=document.getElementById('narr'); return n? n.innerText.slice(-200) : '';})()")
    print("3. 连珠箭多段: 峰值共存飘字 =", peak, "(期望≥2) · 日志片段:", logs.replace('\\n',' ')[-120:])
    try:
        pg2.screenshot(path="slotbar_shot.png")
        print("截图: slotbar_shot.png")
    except Exception as e:
        print("截图失败:", str(e)[:50])
    print("会话2 JS错误:", errs2 if errs2 else "无")
    b2.close()
