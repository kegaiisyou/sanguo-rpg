# -*- coding: utf-8 -*-
import sys
sys.path.insert(0, '/home/user/Doubao/chats/38441852029806082/.pwtest')
from playwright.sync_api import sync_playwright
CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
def ev(page, js):
    try: return page.evaluate(js)
    except Exception as e: return 'ERR:'+str(e)[:200]
OUT='/home/user/Doubao/chats/38441852029806082/sanguo-rpg/.pwtest/z13v'
import os; os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width':560,'height':1000}, device_scale_factor=2)
    page = ctx.new_page()
    errs=[]
    page.on('pageerror', lambda e: errs.append(str(e)[:160]))
    page.goto('http://127.0.0.1:8199/index.html', wait_until='load', timeout=90000)
    page.wait_for_timeout(2500)
    ver = ev(page, "() => { var v=document.getElementById('tt-ver'); return v? v.textContent : ''; }")
    print('VER:', ver)
    ev(page, "() => { var b=document.getElementById('t-start'); if(b) b.click(); }")
    page.wait_for_timeout(900)
    ev(page, "() => { var s=document.querySelector('.slot[data-mode=\"new\"]'); if(s) s.click(); }")
    page.wait_for_timeout(600)
    ev(page, "() => { var b=[...document.querySelectorAll('#modal button,.modal button')].find(x=>/踏\\s*入\\s*江\\s*湖/.test(x.textContent||'')); if(b) b.click(); }")
    page.wait_for_timeout(1500)
    for _ in range(6):
        ev(page, "() => { var s=document.getElementById('pr-skip'); if(s && getComputedStyle(s).display!=='none'){ s.click(); return 'sk'; } return 'no'; }")
        page.wait_for_timeout(600)
    page.wait_for_timeout(900)
    ev(page, "() => { var n=document.getElementById('narr'); if(n) n.style.display='none'; }")
    room=ev(page, "() => window.getState().room")
    print('ROOM:', room)
    # 行囊图标检查（重点 yecai/jiu/zhujian 等新增）
    ev(page, "() => { var S=window.getState(); ['yecai','jiu','fish','dou','zhujian','caizi','tongkuang','xuatie','pickaxe','muti','jinchuang','sleep_drug','shuidai','chutu','tiefu','tangyao','yaofen','douzhong','fish_dried','douzhou','yinkuang'].forEach(function(d){ if(window.LF.ITEMS.DEFS[d]) S.pack.push({defId:d,count:1}); }); window.openModal('pack'); }")
    page.wait_for_timeout(800)
    ic = ev(page, """() => {
        var imgs=[...document.querySelectorAll('#modal img.item-pic48')];
        var miss=imgs.filter(function(i){ var s=(i.getAttribute('src')||''); return s.indexOf('items48')>=0 && (i.naturalWidth===0||!i.complete); });
        return JSON.stringify({total:imgs.length, miss:miss.map(function(i){return i.getAttribute('src');})});
    }""")
    print('ICONS:', ic)
    page.screenshot(path=f'{OUT}/z13_pack.png', timeout=8000, animations='disabled')
    print('ERRORS:', errs[:6] if errs else 'none')
    b.close()
print('DONE')
