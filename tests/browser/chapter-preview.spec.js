import {test,expect} from '@playwright/test'
import {coverEPUB} from './fixtures.js'
test.setTimeout(90000)
async function open(page,mobile=false){
 if(mobile)await page.setViewportSize({width:390,height:844})
 await page.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],addEventListener(){},cancel(){window.__cancels=(window.__cancels??0)+1},pause(){},resume(){},speak(u){window.__utterance=u;u.onstart?.()}}}))
 await page.goto('/');await expect(page.locator('#file-dialog')).toBeVisible();await page.locator('#file-input').setInputFiles({name:'Capitulos.epub',mimeType:'application/epub+zip',buffer:await coverEPUB()});await expect(page.locator('#audio-toggle')).toBeEnabled({timeout:30000});await page.locator('#start-reading').click();await page.locator('#next-page').click();await page.evaluate(()=>document.querySelector('#reader').renderer.whenNavigationIdle?.())
}
const location=page=>page.evaluate(()=>document.querySelector('#reader').lastLocation.cfi)
const preview=(page,label)=>page.locator('.toc-row').filter({has:page.getByRole('button',{name:label,exact:true})}).locator('.toc-preview')
async function index(page){if(await page.locator('#sidebar').isHidden())await page.locator('#index-toggle').click()}

test('preview and close preserve live page, saved location, history and active narration',async({page})=>{
 await open(page);await page.locator('#audio-toggle').click();await expect.poll(()=>page.evaluate(()=>Boolean(window.__utterance))).toBe(true);await index(page)
 const before=await location(page),speech=await page.evaluate(()=>({cancels:window.__cancels,text:window.__utterance.text})),history=await page.locator('#history-back').isHidden(),requests=[];await page.route('https://example.com/**',route=>{requests.push(route.request().url());return route.abort()})
 await preview(page,'El regreso').click();await expect(page.locator('#chapter-preview-content')).toContainText('La mañana había llegado.');await expect(page.locator('#chapter-preview-go')).toBeEnabled();expect(await location(page)).toBe(before);await expect(page.locator('#return-reading')).toBeHidden();expect(await page.locator('#history-back').isHidden()).toBe(history)
 await page.screenshot({path:'test-results/211-preview-desktop.png'});await page.keyboard.press('Escape');await expect(page.locator('#chapter-preview-dialog')).toBeHidden();expect(await location(page)).toBe(before);expect(await page.evaluate(()=>({cancels:window.__cancels,text:window.__utterance.text}))).toEqual(speech);expect(requests).toEqual([]);expect(await page.evaluate(()=>window.__bookExecuted)).toBeUndefined()
})

test('subchapter sample starts at its anchor and only the explicit action navigates',async({page})=>{
 await open(page);await index(page);const before=await location(page);await preview(page,'La ventana').click();await expect(page.locator('#chapter-preview-content')).toContainText('13. El sosiego');await expect(page.locator('#chapter-preview-content')).not.toContainText('12. El sosiego');expect(await location(page)).toBe(before)
 await page.locator('#chapter-preview-go').click();await expect(page.locator('#chapter-preview-dialog')).toBeHidden();await expect.poll(()=>location(page)).not.toBe(before);await expect(page.locator('#history-back')).toBeVisible();await page.locator('#history-back').click();await expect.poll(()=>location(page)).toBe(before)
})

test('position preview is approximate, cancellable and commits the selected percentage only on request',async({page})=>{
 await open(page);const before=await location(page);await page.locator('#position-button').click();await page.locator('#position-input').fill('70');await page.locator('#position-preview').click();await expect(page.locator('#chapter-preview-content p')).not.toHaveCount(0);await expect(page.locator('#chapter-preview-hint')).toContainText('aproximada');expect(await location(page)).toBe(before);await page.locator('#chapter-preview-dialog .dialog-close').click();await expect(page.locator('#position-dialog')).toBeVisible();expect(await location(page)).toBe(before)
 await page.locator('#position-preview').click();await expect(page.locator('#chapter-preview-go')).toBeEnabled();await page.locator('#chapter-preview-go').click();await expect(page.locator('#position-dialog')).toBeHidden();await expect.poll(()=>location(page)).not.toBe(before)
})

test('late samples are discarded after closing or replacing the book',async({page})=>{
 await open(page);await index(page);await page.evaluate(()=>{const reader=document.querySelector('#reader'),section=reader.book.sections[2],original=section.createDocument;window.__previewLoads=0;section.createDocument=()=>{window.__previewLoads++;return new Promise(resolve=>window.__releasePreview=async()=>resolve(await original()))}})
 await preview(page,'El regreso').click();await expect(page.locator('#chapter-preview-go')).toBeDisabled();await page.keyboard.press('Escape');await preview(page,'El jardín').click();await expect(page.locator('#chapter-preview-content')).toContainText('El sosiego');await page.evaluate(()=>window.__releasePreview());await expect(page.locator('#chapter-preview-label')).toHaveText('El jardín');await expect(page.locator('#chapter-preview-content')).not.toContainText('La mañana había llegado.');await page.keyboard.press('Escape')
 await preview(page,'El regreso').click();await page.locator('#file-input').setInputFiles({name:'otro.epub',mimeType:'application/epub+zip',buffer:await coverEPUB('Otro libro')});await expect(page.locator('#opening-cover-image')).toHaveAttribute('alt','Otro libro');await expect(page.locator('#chapter-preview-dialog')).toBeHidden()
})

test('mobile book view, keyboard activation and translated labels keep sample content in its original language',async({page})=>{
 await open(page,true);await page.locator('#theme-toggle').click();await page.locator('[data-appearance=book]').click();await page.keyboard.press('Escape');await page.locator('#preferences-toggle').click();await page.getByText('General',{exact:true}).click();await page.locator('[data-setting=uiLanguage]').selectOption('en');await page.keyboard.press('Escape');await index(page);const before=await location(page)
 const button=preview(page,'El regreso');await expect(button).toHaveAttribute('title','Preview chapter');await button.focus();await page.keyboard.press('Enter');await expect(page.locator('#chapter-preview-content')).toContainText('La mañana había llegado.');await expect(page.locator('#chapter-preview-go')).toHaveText('Go to this location');expect(await location(page)).toBe(before);const box=await page.locator('#chapter-preview-dialog').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390);await page.screenshot({path:'test-results/211-preview-mobile.png'});await page.keyboard.press('Escape');await expect(button).toBeFocused()
})

test('missing text shows an honest message and a retry remains possible',async({page})=>{
 await open(page);await index(page);await page.evaluate(()=>{const section=document.querySelector('#reader').book.sections[2];window.__previewOriginal=section.createDocument;section.createDocument=async()=>{throw Error('test failure')}});const before=await location(page);await preview(page,'El regreso').click();await expect(page.locator('#chapter-preview-status')).toHaveText('No se pudo preparar esta vista previa.');await expect(page.locator('#chapter-preview-go')).toBeDisabled();await page.keyboard.press('Escape');await page.evaluate(()=>document.querySelector('#reader').book.sections[2].createDocument=window.__previewOriginal);await preview(page,'El regreso').click();await expect(page.locator('#chapter-preview-go')).toBeEnabled();expect(await location(page)).toBe(before)
})
