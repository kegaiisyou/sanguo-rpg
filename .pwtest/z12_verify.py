# -*- coding: utf-8 -*-
"""z12 美术资源验证：物品图标 + 场景实体物图标"""
import sys, os
sys.path.insert(0, '/home/user/Doubao/chats/38441852029806082/.pwtest')
from playwright.sync_api import sync_playwright
from exp_base import ev, boot, kill_narr, close_dlg

OUT = '/home/user/Doubao/chats/38441852029806082/sanguo-rpg/.pwtest/z12verify'
os.makedirs(OUT, exist_ok=True)

CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'

def shot(page, name):
    page.screenshot(path=f'{OUT}/{name}.png')

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width':560,'height':1000}, device_scale_factor=2)
    page = ctx.new_page()
    boot(page)
    kill_narr(page); close_dlg(page)
    page.wait_for_timeout(800)

    # 1) 行囊：物品图标（给玩家物品测试）
    ev(page, "() => { if(window.enterGame) window.enterGame('d',1,false); }")
    page.wait_for_timeout(500)
    ev(page, "() => { try{ window.openModal('pack'); return 'ok'; }catch(e){ return 'ERR:'+e.message; } }")
    page.wait_for_timeout(700)
    shot(page, 'pack_items')

    # 检查行囊里 img.item-pic48 数量与 src
    info = ev(page, """() => {
        var imgs=[...document.querySelectorAll('#pack img.item-pic48, .pack-grid img.item-pic48')];
        var srcs=imgs.slice(0,12).map(i=>i.getAttribute('src'));
        var total=imgs.length;
        var broken=imgs.filter(i=>!i.complete || i.naturalWidth===0).length;
        return JSON.stringify({total, broken, srcs});
    }""")
    print('PACK-ICON:', info)

    # 2) 场景物：进药铺看药柜/捣药罐等
    ev(page, "() => { var m=document.getElementById('pack'); if(m) m.style.display='none'; }")
    r1 = ev(page, """() => {
        try{
          // 直接进药铺房间（城市网格内）
          if(window.enterBldRoom) window.enterBldRoom('yaofu', {kind:'city', cid:window.state?.room, x:0, y:0});
          return 'enter';
        }catch(e){ return 'ERR:'+e.message; }
    }""")
    print('ENTER-YAOFU:', r1)
    page.wait_for_timeout(900)
    shot(page, 'scene_yaofu')
    info2 = ev(page, """() => {
        var imgs=[...document.querySelectorAll('#actions img.ui-pic, #objs img.ui-pic')];
        var srcs=imgs.slice(0,15).map(i=>i.getAttribute('src'));
        var total=imgs.length;
        return JSON.stringify({total, srcs});
    }""")
    print('SCENE-ICON:', info2)

    b.close()
print('DONE')
