# -*- coding: utf-8 -*-
from playwright.sync_api import sync_playwright
CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,headless=True,args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':560,'height':1000},device_scale_factor=2).new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)[:150]))
    pg.goto('http://127.0.0.1:8199/index.html',wait_until='load',timeout=90000)
    pg.wait_for_timeout(2500)
    print('VER:',pg.evaluate("()=>document.getElementById('tt-ver').textContent"))
    pg.evaluate("()=>{document.getElementById('t-start').click()}"); pg.wait_for_timeout(900)
    pg.evaluate("()=>document.querySelector('.slot[data-mode=\"new\"]').click()"); pg.wait_for_timeout(600)
    pg.evaluate("()=>{var b=[...document.querySelectorAll('#modal button,.modal button')].find(x=>/踏\\s*入\\s*江\\s*湖/.test(x.textContent));b.click()}"); pg.wait_for_timeout(1500)
    for _ in range(6):
        pg.evaluate("()=>{var s=document.getElementById('pr-skip');if(s&&getComputedStyle(s).display!=='none')s.click()}"); pg.wait_for_timeout(500)
    pg.wait_for_timeout(800)
    pg.evaluate("""()=>{
      var S=window.getState();
      var defs=window.LF.ITEMS.DEFS;
      var sample=['mutan','maopi','shepi','shedan','shengrou','zhuan','yan','xiang','mo','xiaoshuzhi','jade','tiema','zhou','jianyixingzhuang','blank_pass','wooden_pass','guard_tally','heishan_token','war_horse_token','lao_pai','bailian_jian','blade_manual_frag','halberd_manual_page','talisman_scrap','campfire','gongzuotai','sleepmat','horse','ceshizhizhu','shuicao','zhangpeng','tuzhi_yeolian','tuzhi_house','tuzhi_well','tuzhi_gate'];
      sample.forEach(function(d){if(defs[d])S.pack.push({defId:d,count:1})});
      window.openModal('pack');
    }""")
    pg.wait_for_timeout(1500)
    r=pg.evaluate("""()=>{
      var imgs=[...document.querySelectorAll('#modal img.item-pic48')];
      return JSON.stringify({total:imgs.length,miss:imgs.filter(i=>i.naturalWidth===0).map(i=>i.src.split('/').pop())});
    }""")
    print('ICONS:',r)
    pg.screenshot(path='.pwtest/z19_pack.png',animations='disabled',timeout=8000)
    print('ERRS:',errs[:4] if errs else 'none')
    b.close()
