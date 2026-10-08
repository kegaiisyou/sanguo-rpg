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
    r = ev(page, "() => { window.enterGame(null, 0, false); return 'ok'; }")
    page.wait_for_timeout(1500)
    st = ev(page, "() => JSON.stringify({room: window.state && window.state.room, saved: !!window.S})")
    print('AFTER-ENTER:', st)
    page.screenshot(path='/home/user/Doubao/chats/38441852029806082/sanguo-rpg/.pwtest/z12v1.png')

    # 开行囊，先给物品
    ev(page, "() => { try{ window.packAdd && window.packAdd('roubao',1); window.packAdd('fan',1); window.packAdd('zhujian',1); window.packAdd('caizi',1); window.packAdd('tiekuangshi',1); window.packAdd('chutu',1); window.openModal('pack'); }catch(e){ return e.message; } }")
    page.wait_for_timeout(700)
    info = ev(page, """() => {
        var imgs=[...document.querySelectorAll('#pack img.item-pic48')];
        var total=imgs.length;
        var broken=imgs.filter(i=>!i.complete || i.naturalWidth===0).length;
        var srcs=imgs.slice(0,14).map(i=>i.getAttribute('src'));
        return JSON.stringify({total, broken, srcs});
    }""")
    print('PACK-ICON:', info)
    page.screenshot(path='/home/user/Doubao/chats/38441852029806082/sanguo-rpg/.pwtest/z12v2_pack.png')

    # 关行囊，进药铺（若在当前地图有）
    ev(page, "() => { var m=document.getElementById('modal'); if(m) m.style.display='none'; var mm=document.querySelector('.modal'); if(mm) mm.style.display='none'; }")
    r2 = ev(page, "() => { try{ window.enterBldRoom('yaofu',{kind:'city',cid:window.state.room,x:0,y:0}); return 'ok'; }catch(e){ return 'ERR:'+e.message; } }")
    print('ENTER-YAOFU:', r2)
    page.wait_for_timeout(900)
    info2 = ev(page, """() => {
        var imgs=[...document.querySelectorAll('#actions img.ui-pic, .act img.ui-pic, #objs img.ui-pic')];
        var srcs=imgs.slice(0,16).map(i=>i.getAttribute('src'));
        return JSON.stringify({total:imgs.length, srcs});
    }""")
    print('SCENE-ICON:', info2)
    page.screenshot(path='/home/user/Doubao/chats/38441852029806082/sanguo-rpg/.pwtest/z12v3_yaofu.png')
    b.close()
print('DONE')
