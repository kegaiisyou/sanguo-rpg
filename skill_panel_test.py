# -*- coding: utf-8 -*-
"""武学录面板实玩验证：开档 → 角色详情 → 技能 tab → 点武学进详情 → 返回"""
import json, subprocess, sys, time
from playwright.sync_api import sync_playwright

CHROME = "/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome"
URL = "http://localhost:8897/index.html"

def click(sel, page, wait=300):
    page.click(sel); time.sleep(wait/1000.0)

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, headless=True)
        ctx = b.new_context(viewport={"width":390,"height":844})
        pg = ctx.new_page()
        errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL)
        time.sleep(1.5)

        # 新档起步（点空卷直接开档 → 建人 → 入世）
        click("#t-start", pg)
        click(".slot[data-slot=\"1\"]", pg, 1000)
        if pg.locator("#cr-skip").count(): pg.locator("#cr-skip").check()
        if pg.locator("#cr-go").count(): click("#cr-go", pg, 1200)
        time.sleep(1.2)
        click("#btn-enter", pg) if pg.locator("#btn-enter").count() else None
        time.sleep(0.8)

        # 打开角色详情
        click("button[data-modal=\"char\"]", pg)
        time.sleep(0.6)

        # 切到技能 tab
        if pg.locator('.ch-tab[data-pg="skill"]').count():
            click('.ch-tab[data-pg="skill"]', pg)
        time.sleep(0.4)

        # 检查武学录列表
        cards = pg.locator(".ma-card")
        n = cards.count()
        print("武学卡片数:", n)
        assert n > 0, "武学列表为空!"
        names = [cards.nth(i).locator(".ma-n").inner_text() for i in range(n)]
        print("武学名:", names)
        lvs = [cards.nth(i).locator(".ma-lv").inner_text() for i in range(n)]
        print("境界标签:", lvs)

        # 点第一张卡进详情
        first = cards.first
        first.click(); time.sleep(0.5)
        dname = pg.locator(".ma-dname").inner_text() if pg.locator(".ma-dname").count() else "?"
        rows = pg.locator(".ma-row").count()
        bts = pg.locator(".ma-bt").count()
        print("详情名称:", dname)
        print("详情字段行数:", rows, "突破项:", bts)
        assert rows >= 4, "详情字段不足!"
        # 突破项应有内容
        if bts:
            print("首条突破:", pg.locator(".ma-bt").first.inner_text()[:60])

        # 返回列表
        pg.locator(".ma-back").click(); time.sleep(0.4)
        assert pg.locator(".ma-card").count() == n, "返回列表后卡片数不一致!"

        # 无武学时提示（清空验证可选，跳过）

        pg.screenshot(path="skill_panel_shot.png")
        print("ERRORS:", errs if errs else "无")
        print("PASS")
        b.close()

if __name__ == "__main__":
    main()
