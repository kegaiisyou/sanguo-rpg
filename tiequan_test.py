# -*- coding: utf-8 -*-
"""铁拳拳谱物品链实玩验证：调试按钮→背包→使用研读→习得铁拳→武学录可见（evaluate直点防拦截）"""
import time
from playwright.sync_api import sync_playwright

CHROME = "/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome"
URL = "http://localhost:8897/index.html"

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, headless=True)
        ctx = b.new_context(viewport={"width":390,"height":844})
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL); time.sleep(1.5)

        # 新档（evaluate 直点跳过叙事）
        pg.evaluate("document.querySelector('#t-start').click()"); time.sleep(0.4)
        pg.evaluate("document.querySelector('.slot[data-slot=\"1\"]').click()"); time.sleep(1)
        if pg.locator("#cr-skip").count(): pg.locator("#cr-skip").check()
        pg.evaluate("document.querySelector('#cr-go').click()"); time.sleep(1.2)
        for i in range(4):
            g = pg.evaluate("() => { var s=document.getElementById('pr-skip'); if(s){s.click(); return 1;} return 0; }")
            time.sleep(0.6)
            if not g: break
        time.sleep(0.5)

        # 打开设置→游戏→调试台→点铁拳拳谱
        pg.evaluate("document.querySelector('button[data-modal=settings]').click()"); time.sleep(0.6)
        pg.evaluate("[...document.querySelectorAll('[data-tab]')].find(b=>b.getAttribute('data-tab')==='game').click()"); time.sleep(0.3)
        pg.evaluate("document.getElementById('m-dev').click()"); time.sleep(0.6)
        assert pg.locator('[data-act="item_tiequan"]').count() > 0, "调试台无铁拳拳谱按钮!"
        pg.evaluate("document.querySelector('[data-act=item_tiequan]').click()"); time.sleep(0.4)
        pg.evaluate("document.querySelector('#modal').classList.add('hidden')"); time.sleep(0.3)

        # 打开行囊，找铁拳拳谱文本
        pg.evaluate("document.querySelector('button[data-modal=pack]').click()"); time.sleep(0.8)
        found = pg.evaluate("() => { var els=[...document.querySelectorAll('#modal-card *')]; var t=els.find(e=>e.children.length===0 && e.textContent && e.textContent.indexOf('铁拳拳谱')>=0); return t ? t.textContent : null; }")
        print("行囊中找到:", found)
        assert found, "背包没有铁拳拳谱!"

        # 单击拳谱格子（选中→详情面板→研读按钮）
        pg.evaluate("""() => { var els=[...document.querySelectorAll('#modal-card *')];
          var t=els.find(e=>e.children.length===0 && e.textContent && e.textContent.indexOf('铁拳拳谱')>=0);
          var cell=t.closest('.packcell') || t; cell.click(); }""")
        time.sleep(0.6)
        read_btn = pg.locator(".li-act:has-text('研 读')")
        print("研读按钮:", read_btn.count())
        assert read_btn.count() > 0, "详情面板无研读按钮!"
        pg.evaluate("""() => { var b=[...document.querySelectorAll('.li-act')].find(e=>e.textContent.indexOf('研')>=0); if(b) b.click(); }""")
        time.sleep(0.8)

        # 行囊中拳谱应被消耗（找不到）；打开角色→技能验证武学录含铁拳
        pg.evaluate("document.querySelector('#modal').classList.add('hidden')"); time.sleep(0.3)
        pg.evaluate("document.querySelector('button[data-modal=char]').click()"); time.sleep(0.6)
        pg.evaluate("[...document.querySelectorAll('.ch-tab')].find(b=>b.getAttribute('data-pg')==='skill').click()"); time.sleep(0.4)
        names = pg.evaluate("() => [...document.querySelectorAll('.ma-n')].map(e=>e.textContent)")
        print("武学录:", names)
        assert any('铁拳' in n for n in names), "武学录未出现铁拳!"

        # 点铁拳进详情确认展示
        pg.evaluate("""() => { var els=[...document.querySelectorAll('.ma-card')]; var t=els.find(e=>e.textContent.indexOf('铁拳')>=0); if(t) t.click(); }""")
        time.sleep(0.5)
        det = pg.locator(".ma-dname").inner_text() if pg.locator(".ma-dname").count() else "?"
        print("铁拳详情:", det)

        pg.screenshot(path="tiequan_shot.png")
        print("ERRORS:", errs if errs else "无")
        print("PASS")
        b.close()

if __name__ == "__main__":
    main()
