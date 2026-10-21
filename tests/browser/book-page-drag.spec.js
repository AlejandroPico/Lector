import {toolbarAction} from './toolbar-fixture.js'
import {test,expect} from '@playwright/test'
import {coverEPUB} from './fixtures.js'

test.setTimeout(90000)
async function idle(page){await expect(page.locator('.book-turn')).toHaveCount(0);await page.evaluate(async()=>{await Promise.all(document.querySelector('#reading-area').getAnimations().map(a=>a.finished.catch(()=>{})));await document.querySelector('#reader').renderer.whenNavigationIdle?.()})}
const location=page=>page.evaluate(()=>document.querySelector('#reader').lastLocation.cfi)
async function open(page,mobile=false){
 if(mobile)await page.setViewportSize({width:390,height:844})
 await page.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],addEventListener(){},cancel(){window.__cancels=(window.__cancels??0)+1},pause(){},resume(){},speak(u){window.__utterance=u;u.onstart?.()}}}))
 await page.goto('/');await expect(page.locator('#file-dialog')).toBeVisible();await page.locator('#file-input').setInputFiles({name:'Esquinas.epub',mimeType:'application/epub+zip',buffer:await coverEPUB()});await expect(page.locator('#audio-toggle')).toBeEnabled();await toolbarAction(page,'theme-toggle');await page.locator('[data-appearance=book]').click();await page.locator('[data-scene=home]').click();await page.keyboard.press('Escape');await page.locator('#start-reading').click();await idle(page)
 // Leave the native cover section and ensure both directions have a leaf.
 await page.locator('#next-page').click();await idle(page);await page.locator('#next-page').click();await idle(page)
}
async function start(page,direction=1,corner='bottom'){
 const button=page.locator(`.book-corner-${direction>0?'right':'left'}.book-corner-${corner}`),box=await button.boundingBox(),reader=await page.locator('#reader').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2
 await page.mouse.move(x,y);await page.mouse.down();return {x,y,width:reader.width,direction}
}
async function move(page,g,progress){await page.mouse.move(g.x-g.direction*g.width*progress,g.y,{steps:8})}
async function drag(page,direction=1,progress=.5,corner='bottom'){const g=await start(page,direction,corner);await move(page,g,progress);await page.mouse.up();await idle(page)}

test('mouse corners follow the pointer with sandboxed real content and commit once in either direction',async({page})=>{
 await open(page);const before=await location(page);await page.locator('#next-page').click();await idle(page);const next=await location(page);await page.locator('#previous-page').click();await idle(page);expect(await location(page)).toBe(before)
 const g=await start(page);await move(page,g,.22);await expect(page.locator('.book-dragging')).toHaveCount(1);const first=await page.locator('.book-turn-leaf').evaluate(el=>el.style.transform);expect(await location(page)).toBe(before)
 await expect.poll(()=>page.locator('.book-leaf-front iframe').evaluateAll(frames=>frames.some(f=>f.contentDocument?.body.textContent.includes('El sosiego')))).toBe(true)
 expect(await page.locator('.book-leaf-front iframe').first().getAttribute('sandbox')).toBe('allow-same-origin')
 await move(page,g,.55);expect(await page.locator('.book-turn-leaf').evaluate(el=>el.style.transform)).not.toBe(first);await page.screenshot({path:'test-results/210-corner-held.png'});expect(await location(page)).toBe(before);await page.mouse.up();await idle(page);expect(await location(page)).toBe(next)
 await drag(page,-1,.55,'top');expect(await location(page)).toBe(before);await page.screenshot({path:'test-results/210-corner-restored.png'})
})

test('short or reversed drags and Escape preserve position, saved anchor and narration follow',async({page})=>{
 await open(page);await page.locator('#audio-toggle').click();await expect.poll(()=>page.evaluate(()=>Boolean(window.__utterance))).toBe(true)
 const before=await location(page),speech=await page.evaluate(()=>({cancels:window.__cancels,text:window.__utterance.text}));await expect(page.locator('#return-reading')).toBeHidden()
 await drag(page,1,.12);expect(await location(page)).toBe(before)
 const g=await start(page);await move(page,g,.65);await move(page,g,.08);await page.mouse.up();await idle(page);expect(await location(page)).toBe(before)
 const escape=await start(page,-1);await move(page,escape,.5);await page.keyboard.press('Escape');await page.mouse.up();await idle(page);expect(await location(page)).toBe(before);await expect(page.locator('#return-reading')).toBeHidden();expect(await page.evaluate(()=>({cancels:window.__cancels,text:window.__utterance.text}))).toEqual(speech)
 await drag(page);expect(await location(page)).not.toBe(before);await expect(page.locator('#return-reading')).toBeVisible();expect(await page.evaluate(()=>({cancels:window.__cancels,text:window.__utterance.text}))).toEqual(speech)
})

test('touch in portrait commits and cancels without taking text or image gestures',async({page})=>{
 await open(page,true);const before=await location(page),button=await page.locator('.book-corner-right.book-corner-bottom').boundingBox(),reader=await page.locator('#reader').boundingBox(),x=button.x+button.width/2,y=button.y+button.height/2,cdp=await page.context().newCDPSession(page)
 const touch=async(type,px=x)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x:px,y,id:1}]})
 await touch('touchStart');await touch('touchMove',x-reader.width*.2);await expect(page.locator('.book-dragging')).toHaveCount(1);await touch('touchCancel');await idle(page);expect(await location(page)).toBe(before)
 await touch('touchStart');await touch('touchMove',x-reader.width*.55);await touch('touchEnd');await idle(page);expect(await location(page)).not.toBe(before);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await cdp.detach()
 await page.evaluate(()=>{const d=document.querySelector('#reader').renderer.getContents()[0].doc,n=d.querySelector('p').firstChild,r=d.createRange();r.setStart(n,0);r.setEnd(n,10);const s=d.defaultView.getSelection();s.removeAllRanges();s.addRange(r);d.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))});await expect(page.locator('#selection-menu')).toBeVisible();await page.locator('#close-selection').click()
 await page.evaluate(()=>{const d=document.querySelector('#reader').renderer.getContents()[0].doc,img=d.createElement('img');img.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="green"/></svg>');d.body.append(img);img.click()});await expect(page.locator('#image-dialog')).toBeVisible();await page.locator('#image-dialog .dialog-close').click();await page.screenshot({path:'test-results/210-touch-page.png'})
})

test('option, continuous reading and minimalist appearance remove corner interception; keyboard still works',async({page})=>{
 await open(page);await toolbarAction(page,'theme-toggle');await page.locator('[data-setting=bookCornerDrag]').uncheck();await page.keyboard.press('Escape');await expect(page.locator('.book-corner:visible')).toHaveCount(0);const before=await location(page);await page.locator('#reader').focus();await page.keyboard.press('ArrowRight');await idle(page);expect(await location(page)).not.toBe(before)
 await page.reload();await page.locator('.resume-button').first().click();await expect(page.locator('#audio-toggle')).toBeEnabled();await expect(page.locator('.book-corner:visible')).toHaveCount(0)
 await toolbarAction(page,'theme-toggle');await page.locator('[data-setting=bookCornerDrag]').check();await page.keyboard.press('Escape');await expect(page.locator('.book-corner:visible')).toHaveCount(4)
 await page.evaluate(()=>{const input=document.querySelector('[data-setting=readingFlow]');input.value='scrolled';input.dispatchEvent(new Event('input',{bubbles:true}))});await expect(page.locator('.book-corner:visible')).toHaveCount(0)
 await toolbarAction(page,'theme-toggle');await page.locator('[data-appearance=minimal]').click();await expect(page.locator('#book-drag-field')).toBeHidden();await expect(page.locator('.book-corner:visible')).toHaveCount(0)
})

test('reduced motion and disabled animation still allow release navigation without a temporary sheet',async({page})=>{
 await open(page);await page.emulateMedia({reducedMotion:'reduce'});const before=await location(page),g=await start(page);await move(page,g,.55);await expect(page.locator('.book-turn')).toHaveCount(0);expect(await location(page)).toBe(before);await page.mouse.up();await idle(page);expect(await location(page)).not.toBe(before)
 await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{const input=document.querySelector('[data-setting=animated]');input.checked=false;input.dispatchEvent(new Event('input',{bubbles:true}))});const reduced=await location(page),back=await start(page,-1);await move(page,back,.55);await expect(page.locator('.book-turn')).toHaveCount(0);await page.mouse.up();await idle(page);expect(await location(page)).not.toBe(reduced)
})

test('resize, external position navigation and book replacement dispose a held leaf without stale navigation',async({page})=>{
 await open(page);const before=await location(page),g=await start(page);await move(page,g,.5);await page.setViewportSize({width:1366,height:900});await page.mouse.up();await idle(page)
 const second=await start(page);await move(page,second,.5);await page.locator('#position-button').evaluate(el=>el.click());await page.locator('#position-input').fill('70');await page.locator('#go-position').evaluate(el=>el.click());await page.mouse.up();await idle(page);expect(await location(page)).not.toBe(before)
 const third=await start(page);await move(page,third,.5);await page.locator('#file-input').setInputFiles({name:'Otro.epub',mimeType:'application/epub+zip',buffer:await coverEPUB('Otro libro')});await page.mouse.up();await idle(page);await expect(page.locator('#opening-cover-image')).toHaveAttribute('alt','Otro libro');await expect(page.locator('#opening-cover')).toBeVisible();await expect(page.locator('#reader')).toBeHidden()
})

test('camera editing takes priority and scaled corners turn the same logical page',async({page})=>{
 await open(page,true);const before=await location(page);await page.locator('#next-page').click();await idle(page);const next=await location(page);await page.locator('#previous-page').click();await idle(page)
 await toolbarAction(page,'theme-toggle');await page.locator('#book-camera-settings > summary').click();await page.locator('[data-setting=bookCameraZoom]').fill('140');await page.locator('[data-setting=bookCameraY]').fill('100');await page.locator('#book-camera-gestures').check();await expect(page.locator('.book-camera-gesture')).toBeVisible();await page.mouse.move(150,350);await page.mouse.down();await page.mouse.move(210,350,{steps:6});await page.mouse.up();expect(await location(page)).toBe(before);await expect(page.locator('.book-turn')).toHaveCount(0);await page.locator('.book-camera-exit').click()
 // Frame the lower right corner into the visible viewport.
 await toolbarAction(page,'theme-toggle');await page.locator('[data-setting=bookCameraX]').fill('-100');await page.locator('[data-setting=bookCameraY]').fill('-100');await page.keyboard.press('Escape');await drag(page,1,.5);expect(await location(page)).toBe(next)
})

test('new setting and hint translate without opening settings sections or expanding the desktop theme panel',async({page})=>{
 await open(page);await toolbarAction(page,'preferences-toggle');await page.getByText('General',{exact:true}).click();await page.locator('[data-setting=uiLanguage]').selectOption('en');await page.keyboard.press('Escape');await toolbarAction(page,'theme-toggle');await expect(page.locator('#book-drag-field')).toContainText('Turn pages by dragging a corner');await page.keyboard.press('Escape');await expect(page.locator('.book-corner-right').first()).toHaveAttribute('title',/Drag a corner/)
})

test('a chapter boundary is not loaded by a cancelled drag and commits to the real next chapter',async({page})=>{
 await open(page);await page.evaluate(()=>document.querySelector('#reader').renderer.goTo({index:1,anchor:()=>1}));await idle(page)
 const before=await location(page),g=await start(page);await move(page,g,.6);await expect(page.locator('.book-dragging')).toHaveCount(1);await expect(page.locator('.book-leaf-back iframe')).toHaveCount(0);expect(await page.evaluate(()=>document.querySelector('#reader').renderer.getContents()[0].index)).toBe(1);await move(page,g,.1);await page.mouse.up();await idle(page);expect(await location(page)).toBe(before)
 await drag(page);expect(await page.evaluate(()=>document.querySelector('#reader').renderer.getContents()[0].index)).toBe(2);await expect(page.locator('.book-corner')).toHaveCount(4);expect(await location(page)).not.toBe(before)
})
