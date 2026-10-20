import {test,expect} from '@playwright/test'
import {coverEPUB} from './fixtures.js'
test.setTimeout(90000)
async function open(page){
  await page.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],addEventListener(){},cancel(){window.__cancels=(window.__cancels??0)+1},pause(){},resume(){},speak(u){window.__utterance=u;u.onstart?.()}}}))
  await page.goto('/');await expect(page.locator('#file-dialog')).toBeVisible();await page.locator('#file-input').setInputFiles({name:'encuadernacion.epub',mimeType:'application/epub+zip',buffer:await coverEPUB()});await expect(page.locator('#audio-toggle')).toBeEnabled()
  await page.locator('#theme-toggle').click();await page.locator('[data-appearance=book]').click();await page.locator('[data-scene=home]').click();await page.keyboard.press('Escape')
}
async function choose(page,value){await page.locator('#theme-toggle').click();await page.locator('[data-setting=bookBinding]').selectOption(value);await page.keyboard.press('Escape')}
async function idle(page){await expect(page.locator('.book-turn')).toHaveCount(0)}
async function closeFront(page){for(let i=0;i<6&&await page.locator('#opening-cover').isHidden();i++){await page.locator('#previous-page').click();await idle(page)}}

test('three bindings preserve real content, location, paper and active narration, and survive reload',async({page})=>{
 await open(page);await page.locator('#start-reading').click();await idle(page);await page.locator('#audio-toggle').click();await expect.poll(()=>page.evaluate(()=>Boolean(window.__utterance))).toBe(true)
 const before=await page.evaluate(()=>({cfi:document.querySelector('#reader').lastLocation.cfi,cancels:window.__cancels,text:window.__utterance.text,paper:document.documentElement.style.getPropertyValue('--book-paper')}))
 const shadows=[]
 for(const value of ['paperback','notebook','hardcover']){await choose(page,value);await expect(page.locator('body')).toHaveAttribute('data-book-binding',value);shadows.push(await page.locator('.book-folio').evaluate(el=>getComputedStyle(el).boxShadow));expect(await page.evaluate(()=>({cfi:document.querySelector('#reader').lastLocation.cfi,cancels:window.__cancels,text:window.__utterance.text,paper:document.documentElement.style.getPropertyValue('--book-paper')}))).toEqual(before)}
 expect(new Set(shadows).size).toBe(3);await choose(page,'notebook');await page.screenshot({path:'test-results/28-notebook-open.png'})
 await page.reload();await page.locator('#dismiss-file').click();await expect(page.locator('body')).toHaveAttribute('data-book-binding','notebook');await page.locator('#theme-toggle').click();await page.locator('[data-appearance=minimal]').click();await expect(page.locator('#book-binding-field')).toBeHidden();await expect(page.locator('#book-environment')).toBeHidden()
})

test('a complete cover with lining and spine opens and closes without duplicate sheets at rest',async({page})=>{
 await open(page);await page.locator('#start-reading').click();await expect(page.locator('.book-cover-board')).toBeVisible();await expect(page.locator('.book-cover-outside img')).toHaveCount(1);await expect(page.locator('.book-cover-lining')).toHaveCount(1);await expect(page.locator('.book-cover-spine')).toHaveCount(1);await expect(page.locator('.book-turn-leaf')).toHaveCount(0);await idle(page)
 await expect(page.locator('#reader')).toBeVisible();await closeFront(page);await expect(page.locator('#opening-cover')).toBeVisible();await expect(page.locator('#reader')).toBeHidden();await expect(page.locator('.book-folio')).toBeHidden();await expect(page.locator('.cover-moving')).toHaveCount(0)
 await page.screenshot({path:'test-results/28-front-closed.png'});await page.locator('#start-reading').click();await idle(page)
 await page.locator('#position-button').click();await page.locator('#position-input').fill('100');await page.locator('#go-position').click();await page.locator('#next-page').click();await idle(page);await expect(page.locator('#closing-cover')).toBeVisible();await expect(page.locator('#reader')).toBeHidden();await expect(page.locator('.book-folio')).toBeHidden();await page.locator('#previous-page').click();await idle(page);await expect(page.locator('#closing-cover')).toBeHidden();await expect(page.locator('#reader')).toBeVisible()
})

test('mobile closed cover is isolated and disabling motion avoids the cover animation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await open(page);await choose(page,'paperback');await page.locator('#start-reading').click();await idle(page);await closeFront(page);await expect(page.locator('#reader')).toBeHidden();await expect(page.locator('.book-folio')).toBeHidden();await expect(page.locator('#opening-cover')).toBeVisible();await page.screenshot({path:'test-results/28-mobile-closed.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390)
 await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{const input=document.querySelector('[data-setting=animated]');input.checked=false;input.dispatchEvent(new Event('input',{bubbles:true}));window.__coversAdded=0;new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.classList?.contains('book-cover-motion'))window.__coversAdded++}).observe(document.querySelector('#reading-area'),{childList:true})});await page.locator('#start-reading').click();await idle(page);expect(await page.evaluate(()=>window.__coversAdded)).toBe(0);await expect(page.locator('#reader')).toBeVisible()
})

test('binding names translate and changing appearance during a cover animation leaves no inert reader',async({page})=>{
 await open(page);await page.locator('#preferences-toggle').click();await page.getByText('General',{exact:true}).click();await page.locator('[data-setting=uiLanguage]').selectOption('en');await page.keyboard.press('Escape');await page.locator('#theme-toggle').click();await expect(page.locator('#book-binding-field')).toContainText('Binding');await expect(page.locator('[data-setting=bookBinding] option')).toHaveText(['Hardcover','Paperback','Notebook']);await page.keyboard.press('Escape')
 await page.locator('#start-reading').click();await expect(page.locator('.book-cover-motion')).toHaveCount(1);await page.locator('#theme-toggle').click();await page.locator('[data-appearance=minimal]').click();await idle(page);await expect(page.locator('#reader')).toBeVisible();expect(await page.locator('#reader').evaluate(el=>el.inert)).toBe(false);await expect(page.locator('.cover-moving')).toHaveCount(0)
 await page.locator('[data-appearance=book]').click();await page.keyboard.press('Escape');await page.locator('#position-button').click();await page.locator('#position-input').fill('100');await page.locator('#go-position').click();await page.locator('#next-page').click();await expect(page.locator('.book-cover-motion')).toHaveCount(1);await page.locator('#theme-toggle').click();await page.locator('[data-appearance=minimal]').click();await idle(page);await expect(page.locator('#closing-cover')).toBeHidden();await expect(page.locator('#reader')).toBeVisible();expect(await page.locator('#reader').evaluate(el=>el.inert)).toBe(false)
})

test('returning to narration during a closing cover cancels it without interrupting speech',async({page})=>{
 await open(page);await page.locator('#start-reading').click();await idle(page);await page.locator('#audio-toggle').click();await expect.poll(()=>page.evaluate(()=>Boolean(window.__utterance))).toBe(true);const cancels=await page.evaluate(()=>window.__cancels)
 await page.locator('#position-button').click();await page.locator('#position-input').fill('100');await page.locator('#go-position').click();await page.locator('#next-page').click();await expect(page.locator('.book-cover-motion')).toHaveCount(1);await page.locator('#return-reading').click();await idle(page);await expect(page.locator('#closing-cover')).toBeHidden();await expect(page.locator('#reader')).toBeVisible();expect(await page.locator('#reader').evaluate(el=>el.inert)).toBe(false);expect(await page.evaluate(()=>window.__cancels)).toBe(cancels)
})

test('loading another book during a cover transition cannot close or navigate the new book',async({page})=>{
 await open(page);await page.locator('#start-reading').click();await expect(page.locator('.book-cover-motion')).toHaveCount(1)
 await page.locator('#file-input').setInputFiles({name:'otro.epub',mimeType:'application/epub+zip',buffer:await coverEPUB('Otro libro')});await expect(page.locator('#opening-cover-image')).toHaveAttribute('alt','Otro libro');await idle(page);await expect(page.locator('#opening-cover')).toBeVisible();await expect(page.locator('#reader')).toBeHidden();await expect(page.locator('#closing-cover')).toBeHidden();await expect(page.locator('.cover-moving')).toHaveCount(0)
})
