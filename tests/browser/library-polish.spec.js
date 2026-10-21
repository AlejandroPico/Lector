import {toolbarAction} from './toolbar-fixture.js'
import {test,expect} from '@playwright/test'
import {coverEPUB,epub} from './fixtures.js'
async function open(page){await page.goto('/');await page.locator('#file-input').setInputFiles({name:'libro.epub',mimeType:'application/epub+zip',buffer:await epub()});await expect(page.locator('#audio-toggle')).toBeEnabled()}
async function library(page){await page.locator('#index-toggle').click();await page.getByRole('tab',{name:'Libros',exact:true}).click();await page.locator('#library-expand').click()}
async function select(page,words){await page.evaluate(words=>{const view=document.querySelector('#reader'),doc=view.renderer.getContents()[0].doc,walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode())if(node.textContent.includes(words))break;const range=doc.createRange(),start=node.textContent.indexOf(words);range.setStart(node,start);range.setEnd(node,start+words.length);const s=doc.defaultView.getSelection();s.removeAllRanges();s.addRange(range);doc.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))},words);await expect(page.locator('#selection-menu')).toBeVisible()}

test('settings start collapsed and keep their state only while the page is open',async({page})=>{
 await page.goto('/');await page.locator('#dismiss-file').click();await toolbarAction(page,'preferences-toggle');await expect(page.locator('#preferences-panel details[open]')).toHaveCount(0)
 await page.getByText('General',{exact:true}).click();await expect(page.locator('[data-setting="appearance"]')).toBeVisible();await toolbarAction(page,'preferences-toggle');await toolbarAction(page,'preferences-toggle');await expect(page.locator('[data-setting="appearance"]')).toBeVisible()
 await page.reload();await page.locator('#dismiss-file').click();await toolbarAction(page,'preferences-toggle');await expect(page.locator('#preferences-panel details[open]')).toHaveCount(0)
})

test('covers load without clicking, stay fully framed, resize and keep count inside filters',async({page})=>{
 await page.goto('/');const files=[];for(let i=0;i<8;i++)files.push({name:`Libro ${i}.epub`,bytes:[...await coverEPUB('Libro '+i)]})
 await page.evaluate(async files=>{const root=await navigator.storage.getDirectory(),dir=await root.getDirectoryHandle('Libros',{create:true});for(const item of files){const handle=await dir.getFileHandle(item.name,{create:true}),stream=await handle.createWritable();await stream.write(new Uint8Array(item.bytes));await stream.close()}window.showDirectoryPicker=async()=>dir},files)
 await page.locator('#choose-folder').click();await expect(page.locator('#folder-progress')).toBeHidden();await expect.poll(()=>page.locator('#library-list .catalog-cover img').count()).toBeGreaterThan(0)
 await expect(page.locator('#library-filter-dialog #library-count')).toHaveCount(1);await expect(page.locator('.library-results')).toHaveCSS('scrollbar-width','none')
 const cover=page.locator('#library-list .catalog-cover').first();const box=await cover.boundingBox();expect(box.height/box.width).toBeCloseTo(1.5,1)
 await page.locator('#dialog-view-covers').hover();const size=page.locator('#library-dialog .cover-size-popup input');await expect(size).toBeVisible();await size.fill('250');await size.dispatchEvent('input');expect((await cover.boundingBox()).width).toBeGreaterThan(box.width)
 await cover.hover();await expect(page.locator('#library-list .cover-shutter').first()).toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 0)')
 await page.screenshot({path:'test-results/library-polished.png'})
})

test('collections browse, rename, assign and remove books without deleting originals',async({page})=>{
 await open(page);await library(page);await page.locator('#library-collections-toggle').click();await page.locator('#collection-name').fill('Pilares');await page.locator('#collection-create').click();await expect(page.locator('#collection-list')).toContainText('Pilares')
 await page.getByRole('button',{name:'Editar colección: Pilares'}).click();await page.locator('#collection-rename').fill('Favoritos');await page.locator('#collection-save-name').click();await page.locator('#collection-members-toggle').click();await page.locator('#collection-member-list input').check();await page.locator('#collection-save-members').click();await expect(page.locator('#collection-preview')).toContainText('El jardín en silencio')
 await page.locator('#collection-open').click();await expect(page.locator('#filter-collection')).toHaveValue(/.+/);await expect(page.locator('.library-book')).toHaveCount(1)
 await page.locator('#library-collections-toggle').click();await page.getByRole('button',{name:'Editar colección: Favoritos'}).click();await page.locator('#collection-remove').click();await expect(page.locator('#collection-list')).toContainText('Crea una colección');await page.locator('#library-collections-dialog .dialog-close').click();await expect(page.locator('.library-book')).toHaveCount(1)
})

test('nested and identical notes persist independently with distinct marks and 24 swatches',async({page})=>{
 await open(page);for(const [words,text,color] of [['sosiego de la tarde','Nota exterior','blue'],['sosiego','Nota interior','violet'],['sosiego','Otra nota interior','mint']]){
  await select(page,words);await page.locator('#annotate-selection').click();await expect(page.locator('.note-swatches button')).toHaveCount(24);await page.locator('#note-text').fill(text);await page.locator('#note-color').selectOption(color);await page.locator('#save-note').click()
 }
 const notes=await page.evaluate(async()=>{const {allBooks}=await import('/src/storage.js');return (await allBooks())[0].notes});expect(notes).toHaveLength(3);expect(new Set(notes.map(n=>n.id)).size).toBe(3)
 const marks=await page.evaluate(()=>[...document.querySelector('#reader').renderer.getContents()[0].overlayer.element.querySelectorAll('[data-note-id]')].map(node=>node.dataset.noteId));expect(new Set(marks).size).toBe(3)
 const point=await page.evaluate(()=>{const doc=document.querySelector('#reader').renderer.getContents()[0].doc,node=doc.querySelector('p').firstChild,range=doc.createRange(),start=node.textContent.indexOf('sosiego');range.setStart(node,start);range.setEnd(node,start+7);doc.defaultView.getSelection().removeAllRanges();const r=range.getBoundingClientRect(),f=doc.defaultView.frameElement.getBoundingClientRect();return {x:f.x+r.x+r.width/2,y:f.y+r.y+r.height/2}});await page.mouse.click(point.x,point.y);await expect(page.locator('#overlap-dialog')).toBeVisible();await expect(page.locator('.overlap-note')).toHaveCount(3);await page.locator('.overlap-note').nth(1).click();await expect(page.locator('#note-text')).toHaveValue('Nota interior');await page.locator('#note-dialog .dialog-close').click()
 await page.locator('#index-toggle').click();await page.getByRole('tab',{name:'Notas',exact:true}).click();await expect(page.locator('.note-row')).toHaveCount(3)
 await page.locator('.note-row').nth(1).getByRole('button',{name:'Editar nota'}).click();await page.locator('#note-text').fill('Nota interior editada');await page.locator('#save-note').click();await expect(page.locator('.note-row')).toHaveCount(3)
})

test('central theme and voice settings belong to their named sections',async({page})=>{
 await page.goto('/');await page.locator('#dismiss-file').click();await toolbarAction(page,'preferences-toggle')
 const appearance=page.locator('#preferences-panel summary').filter({hasText:/^Apariencia$/});await appearance.click();await expect(appearance.locator('..').locator('.theme-options')).toBeVisible()
 const voice=page.locator('#preferences-panel summary').filter({hasText:/^Voz$/});await voice.click();await expect(voice.locator('..').locator('[data-setting="provider"]')).toBeVisible()
})

test('sidebar distinguishes recent books, has compact titles and resizes covers; folder labels persist',async({page})=>{
 await open(page);await page.evaluate(async()=>{const {saveBook,saveFolder}=await import('/src/storage.js');await saveBook({id:'unread',title:'Sin abrir',filename:'sin-abrir.txt',notes:[],coverSeen:false});const root=await navigator.storage.getDirectory(),handle=await root.getDirectoryHandle('Libros',{create:true});await saveFolder({id:'source',handle,name:'Libros',location:'C:\\Biblioteca personal\\Libros',entries:[]})});await page.reload();await page.locator('#dismiss-file').click();await library(page);await page.locator('#library-sources-toggle').click();await expect(page.locator('.folder-location')).toHaveValue('C:\\Biblioteca personal\\Libros');await page.locator('#library-sources-dialog .dialog-close').click();await page.locator('#library-dialog-close').click()
 await expect(page.locator('.sidebar-recent-divider')).toHaveCount(1);await page.locator('#library-view-covers').click();await page.locator('#sidebar .cover-size-popup input').fill('280');await page.locator('#sidebar .cover-size-popup input').dispatchEvent('input');expect(await page.locator('#sidebar-library-list').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(1)
 await page.locator('#library-view-list').click();expect(await page.locator('.sidebar-book').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeLessThanOrEqual(12)
})

test('physical book turns actual text, restores minimal layout and respects reduced motion',async({page})=>{
 await open(page);await toolbarAction(page,'preferences-toggle');await page.getByText('General',{exact:true}).click();await page.locator('[data-setting="appearance"]').selectOption('book');await expect(page.locator('body')).toHaveClass(/physical-book/)
 await toolbarAction(page,'theme-toggle');await page.locator('[data-scene="cabin"]').click();await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>document.querySelector('#reader').renderer.columnCount)).toBe(2)
 await page.screenshot({path:'test-results/book-cabin.png'});const before=await page.evaluate(()=>document.querySelector('#reader').lastLocation.cfi);await page.locator('#next-page').click();await expect(page.locator('.book-turn')).toBeVisible();await expect.poll(()=>page.locator('.book-leaf-front iframe').count()).toBeGreaterThan(0);await page.screenshot({path:'test-results/book-turn.png'});await expect(page.locator('.book-turn')).toHaveCount(0);expect(await page.evaluate(()=>document.querySelector('#reader').lastLocation.cfi)).not.toBe(before)
 await toolbarAction(page,'preferences-toggle');await page.locator('[data-setting="appearance"]').selectOption('minimal');await page.keyboard.press('Escape');await expect(page.locator('body')).not.toHaveClass(/physical-book/);await expect(page.locator('#book-environment')).toBeHidden()
 await page.emulateMedia({reducedMotion:'reduce'});await toolbarAction(page,'preferences-toggle');await page.locator('[data-setting="appearance"]').selectOption('book');await page.keyboard.press('Escape');await page.locator('#next-page').click();await expect(page.locator('.book-turn')).toHaveCount(0)
})

test('book on a phone uses one page and remains within the screen',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);await toolbarAction(page,'preferences-toggle');await page.getByText('General',{exact:true}).click();await page.locator('[data-setting="appearance"]').selectOption('book');await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>document.querySelector('#reader').renderer.columnCount)).toBe(1)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await page.screenshot({path:'test-results/book-mobile.png'})
})

test('front cover opens as a book, rear cover returns to the last spread and voice keeps playing',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],addEventListener(){},cancel(){window.__cancel=(window.__cancel??0)+1},pause(){},resume(){},speak(u){window.__utterance=u;u.onstart?.()}}}))
 await page.goto('/');await page.locator('#file-input').setInputFiles({name:'cubierta.epub',mimeType:'application/epub+zip',buffer:await coverEPUB()});await expect(page.locator('#opening-cover')).toBeVisible()
 await toolbarAction(page,'preferences-toggle');await page.getByText('General',{exact:true}).click();await page.locator('[data-setting="appearance"]').selectOption('book');await page.keyboard.press('Escape');await expect(page.locator('#opening-cover')).toBeVisible();await page.screenshot({path:'test-results/book-cover.png'});await page.locator('#start-reading').click();await expect(page.locator('.book-turn')).toHaveCount(0);await expect(page.locator('#opening-cover')).toBeHidden()
 await page.locator('#audio-toggle').click();await expect.poll(()=>page.evaluate(()=>window.__utterance?.text)).toBeTruthy();const before=await page.evaluate(()=>({text:window.__utterance.text,cancel:window.__cancel}))
 await page.locator('#next-page').click();await expect(page.locator('.book-turn')).toHaveCount(0)
 await page.locator('#position-button').click();await page.locator('#position-input').fill('100');await page.locator('#go-position').click();await page.locator('#next-page').click();await expect(page.locator('#closing-cover')).toBeVisible();await expect(page.locator('.book-turn')).toHaveCount(0);await page.screenshot({path:'test-results/book-back.png'});await page.locator('#return-reading').click();await expect(page.locator('#closing-cover')).toBeHidden();await page.locator('#position-button').click();await page.locator('#position-input').fill('100');await page.locator('#go-position').click();await page.locator('#next-page').click();await expect(page.locator('#closing-cover')).toBeVisible();await expect(page.locator('.book-turn')).toHaveCount(0);await page.locator('#previous-page').click();await expect(page.locator('#closing-cover')).toBeHidden();await expect(page.locator('.book-turn')).toHaveCount(0)
 expect(await page.evaluate(()=>({text:window.__utterance.text,cancel:window.__cancel}))).toEqual(before);await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-label','Pausar lectura')
})

test('a touch cover first reveals its details and a second touch opens the book',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,locale:'es-ES',baseURL:'http://127.0.0.1:5177'}),page=await context.newPage()
 await open(page);await library(page);await page.locator('#library-list .catalog-cover').first().tap();await expect(page.locator('#library-dialog')).toBeVisible();await expect(page.locator('#library-list .library-row').first()).toHaveClass(/details-open/);await page.locator('#library-list .catalog-cover').first().tap();await expect(page.locator('#library-dialog')).toBeHidden();await context.close()
})

test('new cover controls and colour samples change from system English to Spanish',async({browser})=>{
 const context=await browser.newContext({locale:'en-US',baseURL:'http://127.0.0.1:5177'}),page=await context.newPage();await open(page);await toolbarAction(page,'preferences-toggle');await page.locator('#preferences-panel > details').first().locator('summary').first().click();await page.locator('[data-setting="uiLanguage"]').selectOption('es');await page.keyboard.press('Escape');await expect(page.locator('#library-dialog .cover-size-popup label')).toHaveText('Tamaño de portadas');await select(page,'sosiego');await page.locator('#annotate-selection').click();await expect(page.locator('.note-swatches [data-note-color="violet"]')).toHaveAttribute('aria-label','Violeta');await context.close()
})
