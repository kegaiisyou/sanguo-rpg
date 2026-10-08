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
    ev(page, "() => { var b=document.getElementById('t-start'); if(b) b.click(); }")
    page.wait_for_timeout(900)
    ev(page, "() => { var s=document.querySelector('.slot[data-mode=\"new\"]'); if(s) s.click(); }")
    page.wait_for_timeout(600)
    ev(page, "() => { var b=[...document.querySelectorAll('#modal button,.modal button')].find(x=>/踏\\s*入\\s*江\\s*湖/.test(x.textContent||'')); if(b) b.click(); }")
    page.wait_for_timeout(1500)
    for _ in range(6):
        ev(page, "() => { var s=document.getElementById('pr-skip'); if(s && getComputedStyle(s).display!=='none'){ s.click(); return 'sk'; } return 'no'; }")
        page.wait_for_timeout(600)
    page.wait_for_timeout(1000)
    ev(page, "() => { try{ var S=window.LF.Core.state; ['yecai','jiu','fish','fish_dried','dou','douzhou','caizi','douzhong','tongkuang','yinkuang','xuatie','tiefu','pickaxe','muti','jinchuang','yaofen','tangyao','sleep_drug','shuidai','zhujian','chutu'].forEach(function(d){ var it=window.LF.ITEMS.DEFS[d]; if(it) S.pack.push({defId:d,count:1}); }); }catch(e){} }")
    ev(page, "() => { window.openModal('pack'); }")
    page.wait_for_timeout(900)
    detail = ev(page, """() => {
        var imgs=[...document.querySelectorAll('#modal img.item-pic48')];
        var out=imgs.map(function(i){
            return {src:(i.getAttribute('src')||'').split('/').pop(), w:i.naturalWidth, cls:i.className};
        });
        var txt=document.getElementById('modal').innerText;
        var hasYecai=txt.indexOf('yecai')>=0 || txt.indexOf('野菜')>=0;
        return JSON.stringify({imgs:out, hasYecai:hasYecai});
    }""")
    print('DETAIL:', detail)
    b.close()
print('DONE')
