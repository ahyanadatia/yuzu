import asyncio, base64, io
from playwright.async_api import async_playwright
from PIL import Image
buf = io.BytesIO(); Image.new('RGB', (1600, 1200), (200, 60, 40)).save(buf, 'JPEG'); JPG = buf.getvalue()
URL = 'http://localhost:8787/index.html'
async def toast(pg): return (await pg.inner_text('#toast')).strip()
async def add_goal(pg, kind, title, cat, extra=None):
    await pg.click(f'[data-act=add][data-t={kind}]:not([data-up])'); await pg.fill('#e_t', title); await pg.select_option('#e_c', cat); await pg.fill('#e_p', 'A photo')
    for k, v in (extra or {}).items(): await pg.fill('#' + k, v)
    await pg.click('form[data-form=goal] button.btn'); await pg.wait_for_timeout(250)
async def join(pg, phone, name, code='TEST-CODE', pin='123456'):
    await pg.goto(URL); await pg.wait_for_selector('#a_phone')
    await pg.fill('#a_phone', phone); await pg.fill('#a_name', name); await pg.fill('#a_pin', pin); await pg.fill('#a_code', code); await pg.click('#authGo'); await pg.wait_for_timeout(900)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        errs = []
        ca = await b.new_context(viewport={'width': 390, 'height': 844}); A = await ca.new_page(); A.on('pageerror', lambda e: errs.append('A ' + str(e)))
        cb = await b.new_context(viewport={'width': 390, 'height': 844}); B = await cb.new_page(); B.on('pageerror', lambda e: errs.append('B ' + str(e)))
        # wrong invite code is refused
        await join(A, '07700 900111', 'Asif', code='NOPE'); print('bad code ->', await A.inner_text('#authErr'))
        await A.screenshot(path='tests/a_auth.png'); await A.fill('#a_code', 'test-code'); await A.click('#authGo'); await A.wait_for_timeout(1500); await A.screenshot(path='tests/a_join.png'); await A.wait_for_timeout(1300)
        print('A signed in as:', (await A.inner_text('.who')).split('Change')[0].strip())
        await add_goal(A, 'd', 'Hit my protein', 'Athletic', {'e_ml': 'Protein', 'e_mt': '150', 'e_mu': 'g'})
        await add_goal(A, 'd', 'Study 2 hours', 'Academic')
        await add_goal(A, 'w', 'Write 500 words', 'Creative', {'e_s': 'Draft done'})
        await add_goal(A, 's', 'Past paper score', 'Academic', {'e_b': '54', 'e_g': '65', 'e_u': '%'})
        print('A goals:', await A.locator('article.goal').count())
        await A.fill('input[id^=v_]', '160'); await A.click('[data-act=tick] >> nth=0'); await A.wait_for_timeout(200)
        await A.click('[data-act=tick]'); await A.wait_for_timeout(200)
        await A.click('[data-act=close]'); await A.wait_for_timeout(300); print('A close ->', await toast(A))
        await A.set_input_files('input[data-day]', {'name': 'p.jpg', 'mimeType': 'image/jpeg', 'buffer': JPG}); await A.wait_for_timeout(1000); print('A upload ->', (await A.inner_text('.pop-text')) if await A.locator('.pop-text').count() else 'NO CELEBRATION'); await A.screenshot(path='tests/a_pop.png'); await A.wait_for_timeout(1600);         await A.screenshot(path='tests/a_today.png')
        # B joins on another phone; duplicate phone and name are refused
        await join(B, '07700 900111', 'Maya'); print('dup phone ->', await B.inner_text('#authErr'))
        await B.fill('#a_phone', '+44 7700 900222'); await B.fill('#a_name', 'asif'); await B.click('#authGo'); await B.wait_for_timeout(700); print('dup name ->', await B.inner_text('#authErr'))
        await B.fill('#a_name', 'Maya'); await B.click('#authGo'); await B.wait_for_timeout(900)
        await B.click('[data-v=board]'); await B.wait_for_timeout(300); print('B league rows:', await B.locator('.lrow').count(), '| top:', (await B.inner_text('.lrow >> nth=0')).replace('\n', ' '))
        await B.click('[data-v=feed]'); await B.wait_for_timeout(1500)
        print('B ref items:', await B.locator('[data-act=rv][data-v="1"]').count(), '| image loaded:', await B.locator('img.shot').count())
        await B.screenshot(path='tests/b_feed.png', full_page=True)
        while await B.locator('[data-act=rv][data-v="1"]').count():
            await B.click('[data-act=rv][data-v="1"] >> nth=0'); await B.wait_for_timeout(300)
        await B.wait_for_timeout(600)
        # A reloads (session persists), syncs, and sees the day verified
        await A.reload(); await A.wait_for_timeout(1200)
        print('A after reload, day state:', (await A.inner_text('.state.ok >> nth=-1')).strip() if await A.locator('text=Day verified').count() else 'NOT VERIFIED')
        print('A score:', (await A.inner_text('.big')).replace('\n', ' '))
        # sign out, wrong PIN, right PIN
        await A.click('[data-act=signout]'); await A.wait_for_timeout(400)
        await A.fill('#a_phone', '07700900111'); await A.fill('#a_pin', '000000'); await A.click('#authGo'); await A.wait_for_timeout(1200); print('wrong pin ->', await A.inner_text('#authErr'))
        await A.fill('#a_pin', '123456'); await A.click('#authGo'); await A.wait_for_timeout(1200); print('A back in:', await A.locator('article.goal').count(), 'goals')
        print('errors:', errs)
        await b.close()
asyncio.run(main())
