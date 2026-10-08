# -*- coding: utf-8 -*-
import sys
sys.path.insert(0, '/home/user/Doubao/chats/38441852029806082/.pwtest')
from playwright.sync_api import sync_playwright
from exp_base import ev, boot, kill_narr, close_dlg

CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width':560,'height':1000}, device_scale_factor=2)
    page = ctx.new_page()
    boot(page)
    kill_narr(page); close_dlg(page)
    page.wait_for_timeout(800)

    st = ev(page, "() => JSON.stringify({saved: !!window.S, room: window.state && window.state.room, stage: window.state && window.state.stage, modal: window.modalOpen || (window.openModal && 'openModal exists')})")
    print('STATE:', st)

    ev(page, "() => { try{ window.openModal('pack'); return 'ok'; }catch(e){ return 'ERR:'+e.message; } }")
    page.wait_for_timeout(600)
    dump = ev(page, "() => { var m=document.getElementById('pack'); return m ? ('modal display='+getComputedStyle(m).display+' html-len='+m.innerHTML.length+' head='+m.innerHTML.slice(0,600)) : 'no #pack'; }")
    print('PACK-DOM:', dump[:800])

    # 看看有哪些 modal
    modals = ev(page, "() => [...document.querySelectorAll('.modal, [id]')].filter(e=>e.id).map(e=>e.id).slice(0,40).join(',')")
    print('IDS:', modals[:400])
    b.close()
print('DONE')
