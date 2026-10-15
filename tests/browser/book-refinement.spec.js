import {test,expect} from '@playwright/test'
import JSZip from 'jszip'
import {epub,coverEPUB} from './fixtures.js'
async function open(page,buffer){await page.goto('/');await page.locator('#file-input').setInputFiles({name:'libro.epub',mimeType:'application/epub+zip',buffer:buffer??await epub()});await expect(page.locator('#audio-toggle')).toBeEnabled()}
async function library(page){if(await page.locator('#sidebar').isHidden())await page.locator('#index-toggle').click();await page.getByRole('tab',{name:'Libros',exact:true}).click();await page.locator('#library-expand').click()}
async function physical(page){await page.locator('#theme-toggle').click();await page.locator('[data-appearance="book"]').click();await expect(page.locator('#scene-options')).toBeVisible();await page.keyboard.press('Escape')}

test('one folder book and its cached reading share a compact library entry without a delete button',async({page})=>{
 const buffer=await coverEPUB();await open(page,buffer);await page.locator('#start-reading').click()
 await page.evaluate(async bytes=>{const root=await navigator.storage.getDirectory(),dir=await root.getDirectoryHandle('Libros',{create:true}),handle=await dir.getFileHandle('same.epub',{create:true}),stream=await handle.createWritable();await stream.write(new Uint8Array(bytes));await stream.close();window.showDirectoryPicker=async()=>dir},[...buffer])
 await page.locator('#open-file').click();await page.locator('#choose-folder').click();await expect(page.locator('#folder-progress')).toBeHidden();await expect(page.locator('#library-list .library-row')).toHaveCount(1)
 await page.locator('#dialog-view-list').click();await expect(page.locator('#library-list .library-row')).toHaveCount(1);await expect(page.locator('#library-list [aria-label="Quitar de la biblioteca"]')).toHaveCount(0)
 const row=page.locator('#library-list .library-row');expect((await row.boundingBox()).height).toBeLessThanOrEqual(38);await expect(row.locator('.library-row-actions .catalog-formats')).toContainText('EPUB');await expect(row.locator('.library-author')).toContainText('Libro de prueba')
 await row.locator('.library-book').click();await expect(page.locator('#audio-toggle')).toBeEnabled();await library(page);await expect(page.locator('#library-list .library-row')).toHaveCount(1)
})

test('the collections field filters existing names and creates on Enter or plus',async({page})=>{
 await open(page);await library(page);await page.locator('#library-collections-toggle').click();const input=page.locator('#collection-name')
 await input.fill('Pilares');await input.press('Enter');await expect(page.locator('.collection-row')).toHaveCount(1)
 await input.fill('Viajes');await page.locator('#collection-create').click();await expect(page.locator('.collection-row')).toHaveCount(2)
 await input.fill('pila');await expect(page.locator('.collection-row')).toHaveCount(1);await expect(page.locator('.collection-row')).toContainText('Pilares')
 await input.fill('Nueva');await expect(page.locator('.collection-row')).toHaveCount(0);await input.press('Enter');await expect(page.locator('.collection-row')).toHaveCount(3)
})

test('themes switch appearance in place, show all desk thumbnails and hide the schedule and scrollbar',async({page})=>{
 await open(page);await page.locator('#theme-toggle').click();await expect(page.locator('#theme-panel')).toHaveCSS('scrollbar-width','none');await expect(page.locator('[data-theme="auto"]')).toHaveAttribute('title',/mañana de 7/)
 await expect(page.locator('#theme-panel p').filter({hasText:'Automático: mañana'})).toHaveCount(0)
 await page.locator('[data-appearance="book"]').click();await expect(page.locator('.theme-options')).toBeHidden();await expect(page.locator('[data-scene]')).toHaveCount(12)
 for(const scene of ['library','bamboo','garden','study']){await page.locator(`[data-scene="${scene}"]`).click();await expect(page.locator('body')).toHaveAttribute('data-book-scene',scene);await expect(page.locator(`[data-scene="${scene}"]`)).toHaveAttribute('aria-pressed','true');expect(await page.locator(`[data-scene="${scene}"] .scene-thumbnail`).evaluate(el=>getComputedStyle(el).backgroundImage)).toContain(scene+'.webp')}
 await page.screenshot({path:'release/qa/111-theme-picker.png'});await page.locator('[data-appearance="minimal"]').click();await expect(page.locator('.theme-options')).toBeVisible();await expect(page.locator('#scene-options')).toBeHidden()
})

test('physical width follows reading width, transparent chrome shows the desk, and outer edges turn pages without cancelling speech',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],addEventListener(){},cancel(){window.__cancel=(window.__cancel??0)+1},pause(){},resume(){},speak(u){window.__utterance=u;u.onstart?.()}}}))
 await open(page);await physical(page);await page.locator('#audio-toggle').click();await expect.poll(()=>page.evaluate(()=>window.__utterance?.text)).toBeTruthy();const cancelled=await page.evaluate(()=>window.__cancel)
 const before=(await page.locator('#reading-area').boundingBox()).width
 await page.locator('#appearance-toggle').click();await page.locator('#appearance-panel summary').filter({hasText:'Espaciado, márgenes y fuentes'}).click();await page.locator('#width').fill('760');await page.locator('#width').dispatchEvent('input');await page.keyboard.press('Escape');await expect.poll(async()=>(await page.locator('#reading-area').boundingBox()).width).toBeLessThan(before-100)
 await expect(page.locator('.toolbar')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(page.locator('.reading-footer')).toHaveCSS('background-color','rgba(0, 0, 0, 0)')
 const cfi=await page.evaluate(()=>document.querySelector('#reader').lastLocation.cfi);await page.locator('#book-edge-right').click();await expect(page.locator('.book-turn')).toHaveCount(0);expect(await page.evaluate(()=>document.querySelector('#reader').lastLocation.cfi)).not.toBe(cfi)
 await page.locator('#book-edge-left').click();await expect(page.locator('.book-turn')).toHaveCount(0);expect(await page.evaluate(()=>window.__cancel)).toBe(cancelled);await page.screenshot({path:'release/qa/111-book-width.png'})
})

test('portrait mobile focuses real left and right pages and can also show the full book',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);await physical(page);await expect.poll(()=>page.evaluate(()=>document.querySelector('#reader').renderer.columnCount)).toBe(1)
 const side=await page.locator('#reading-area').getAttribute('data-book-side'),other=side==='left'?'right':'left',before=await page.evaluate(()=>document.querySelector('#reader').lastLocation.cfi)
 await page.locator(`[data-book-side="${other}"]`).click();await expect(page.locator('.book-turn')).toHaveCount(0);expect(await page.evaluate(()=>document.querySelector('#reader').lastLocation.cfi)).not.toBe(before);await expect(page.locator('#reading-area')).toHaveAttribute('data-book-side',other)
 await page.screenshot({path:'release/qa/111-phone-page.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390)
 await page.locator('#theme-toggle').click();await page.locator('[data-setting="bookMobileView"]').selectOption('spread');await page.keyboard.press('Escape');await expect(page.locator('#book-page-focus')).toBeHidden();await expect.poll(()=>page.evaluate(()=>document.querySelector('#reader').renderer.columnCount)).toBe(2)
 await page.setViewportSize({width:844,height:390});await expect(page.locator('#reading-area')).not.toHaveClass(/book-focused/)
})


test('a folder reading without a usable cover is still unified by content',async({page})=>{
 const zip=await JSZip.loadAsync(await epub()),opf=await zip.file('OPS/book.opf').async('string')
 zip.file('OPS/book.opf',opf.replace(/<item id="cover"[^>]*\/>/,''));zip.remove('OPS/cover.png');const buffer=await zip.generateAsync({type:'nodebuffer'})
 await open(page,buffer)
 await page.evaluate(async bytes=>{const root=await navigator.storage.getDirectory(),dir=await root.getDirectoryHandle('Sin portada',{create:true}),handle=await dir.getFileHandle('same.epub',{create:true}),stream=await handle.createWritable();await stream.write(new Uint8Array(bytes));await stream.close();window.showDirectoryPicker=async()=>dir},[...buffer])
 await page.locator('#open-file').click();await page.locator('#choose-folder').click();await expect(page.locator('#folder-progress')).toBeHidden();await expect(page.locator('#library-list .library-row')).toHaveCount(1)
 await page.reload();await page.locator('#dismiss-file').click();await library(page);await expect(page.locator('#library-list .library-row')).toHaveCount(1)
})
