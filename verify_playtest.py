from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page()
    failed = []
    page.on('response', lambda r: failed.append((r.status, r.url)) if r.status >= 400 else None)
    page.goto('http://127.0.0.1:8770/index.html')
    page.wait_for_timeout(1500)
    info = page.evaluate('''() => ({
        events: (window.LF && window.LF.EVENTS) ? window.LF.EVENTS.length : -1,
        martial: (window.LF && window.LF.MARTIAL_ARTS) ? Object.keys(window.LF.MARTIAL_ARTS).filter(k=>window.LF.MARTIAL_ARTS[k]&&window.LF.MARTIAL_ARTS[k].line).length : -1,
        bodyLen: document.body.innerText.length
    })''')
    b.close()
    print('EVENTS:', info['events'], 'MARTIAL:', info['martial'], 'BODY:', info['bodyLen'])
    print('FAILED/404 responses:')
    for s, u in failed:
        print('  ', s, u)
