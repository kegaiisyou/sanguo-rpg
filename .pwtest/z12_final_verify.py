# -*- coding: utf-8 -*-
import sys
sys.path.insert(0, '/home/user/Doubao/chats/38441852029806082/.pwtest')
from playwright.sync_api import sync_playwright

CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
OUT='/home/user/Doubao/chats/38441852029806082/sanguo-rpg/.pwtest/z12v'
import os; os.makedirs(OUT, exist_ok=True)
def ev(page, js):
    try: return page.evaluate(js)
    except Exception as e: return 'ERR:'+str(e)[:200]

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width':560,'height':1000}, device_scale_factor=2)
    page = ctx.new_page()
    page.goto('http://127.0.0.1:8199/index.html', wait_until='load', timeout=90000)
    page.wait_for_timeout(2500)
    ev(page, "() => { var b=document.getElementById('t-start'); if(b) b.click(); }")
    page.wait_for_timeout(1000)
    ev(page, "() => { var s=document.querySelector('.slot[data-mode=\"new\"]'); if(s) s.click(); }")
    page.wait_for_timeout(800)
    ev(page, "() => { var b=[...document.querySelectorAll('#modal button,.modal button')].find(x=>/踏\s*入\s*江\s*湖/.test(x.textContent||'')); if(b) b.click(); }")
    page.wait_for_timeout(1500)
    # 跳过序章（若在播放）
    for _ in range(6):
        r = ev(page, "() => { var s=document.getElementById('pr-skip'); if(s && getComputedStyle(s).display!=='none'){ s.click(); return 'skipped'; } return 'no'; }")
        page.wait_for_timeout(700)
    # 等 app 可见
    for _ in range(10):
        vis = ev(page, "() => { var a=document.getElementById('app'); return a && getComputedStyle(a).display!=='none'; }")
        if vis == True: break
        page.wait_for_timeout(800)
    page.wait_for_timeout(1200)
    st = ev(page, "() => JSON.stringify({room: window.LF && window.LF.Core && window.LF.Core.state ? window.LF.Core.state.room : null})")
    print('ROOM:', st)
    page.screenshot(path=f'{OUT}/room0.png', timeout=8000, animations='disabled')

    # 关叙事/对话框
    ev(page, "() => { var n=document.getElementById('narr'); if(n) n.style.display='none'; var d=document.getElementById('dlg'); if(d) d.style.display='none'; }")
    # 行囊：给物品
    ev(page, "() => { try{ window.LFUI && window.LFUI.usePackItem; }catch(e){} }")
    add = ev(page, """() => {
        try{
          var S = window.LF && window.LF.Core ? window.LF.Core.state : null;
          if(!S) return 'no state';
          var added=[];
          ['roubao','fan','xizhou','yecai','yeguo','jiu','fish','fish_dried','dou','douzhou','zhujian','caizi','douzhong','mutou','mucai','shitiao','tiekuangshi','tongkuang','yinkuang','tiekuai','xuatie','chutu','futou','tiefu','pickaxe','muti','jinchuang','yaofen','tangyao','sleep_drug','shuidai'].forEach(function(d){
            var it = window.LF.ITEMS && window.LF.ITEMS.DEFS && window.LF.ITEMS.DEFS[d];
            if(it){ S.pack.push({defId:d, count:1}); added.push(d); }
          });
          return 'added '+added.length;
        }catch(e){ return 'ERR:'+e.message; }
    }""")
    print('ADD:', add)
    ev(page, "() => { try{ window.LFUI && window.openModal && window.openModal('pack'); }catch(e){ return e.message; } }")
    page.wait_for_timeout(700)
    info = ev(page, """() => {
        var imgs=[...document.querySelectorAll('#pack img.item-pic48, .pack-grid img.item-pic48, img.item-pic48')];
        var srcs=imgs.slice(0,18).map(i=>i.getAttribute('src'));
        var total=imgs.length;
        var broken=imgs.filter(i=>!i.complete || i.naturalWidth===0 || i.getAttribute('src').indexOf('items48')>=0 && i.naturalWidth===0).length;
        return JSON.stringify({total, srcs});
    }""")
    print('PACK-ICON:', info)
    page.screenshot(path=f'{OUT}/pack.png', timeout=8000, animations='disabled')
    b.close()
print('DONE')
