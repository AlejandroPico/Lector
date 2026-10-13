import {test,expect} from '@playwright/test'
import {coverEPUB,epub} from './fixtures.js'
async function select(page,word='sosiego'){
  await expect.poll(()=>page.evaluate(word=>document.querySelector('#reader').renderer.getContents()[0]?.doc.body.textContent.includes(word)??false,word)).toBe(true)
  await page.evaluate(word=>{
    const doc=document.querySelector('#reader').renderer.getContents()[0].doc,walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);let node
    while(node=walker.nextNode())if(node.textContent.includes(word))break
    const range=doc.createRange(),start=node.textContent.indexOf(word);range.setStart(node,start);range.setEnd(node,start+word.length)
    const selection=doc.defaultView.getSelection();selection.removeAllRanges();selection.addRange(range);doc.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))
  },word);await expect(page.locator('#selection-menu')).toBeVisible()
}
async function open(page){await page.goto('/');await page.locator('#file-input').setInputFiles({name:'test.epub',mimeType:'application/epub+zip',buffer:await epub()});await expect(page.locator('#audio-toggle')).toBeEnabled()}
async function notes(page){return page.evaluate(async()=>{const {allBooks}=await import('/src/storage.js');return (await allBooks()).flatMap(book=>book.notes.map(note=>({title:book.title,...note})))})}
const overlayColor=page=>page.evaluate(()=>[...document.querySelector('#reader').renderer.getContents()[0].doc.defaultView.frameElement.parentElement.querySelectorAll('svg g')].map(node=>node.getAttribute('fill')))
test('colored marks retain their anchor, edit without duplicating and can be hidden',async({page})=>{
  await open(page);await select(page);await page.locator('#highlight-selection').click();await page.locator('#note-color').selectOption('green');await page.locator('#save-note').click()
  await expect.poll(()=>notes(page).then(items=>items.length)).toBe(1)
  const first=(await notes(page))[0];expect(first.kind).toBe('highlight');expect(first.color).toBe('green')
  await expect.poll(()=>overlayColor(page)).toContain('#3b8e68')
  await select(page);await page.locator('#annotate-selection').click();await page.locator('#note-text').fill('Texto editado.');await page.locator('#note-color').selectOption('blue');await page.locator('#note-style').selectOption('highlight');await page.locator('#save-note').click()
  await expect.poll(()=>notes(page).then(items=>items[0].text)).toBe('Texto editado.')
  expect((await notes(page))[0]).toMatchObject({id:first.id,cfi:first.cfi,kind:'note',color:'blue',style:'highlight'})
  await expect.poll(()=>overlayColor(page)).toContain('#438acc')
  await page.locator('#preferences-toggle').click();await page.locator('#preferences-panel summary').filter({hasText:'Notas y vocabulario'}).click();await page.locator('[data-setting="showAnnotations"]').uncheck()
  await expect.poll(()=>overlayColor(page)).toEqual([])
  await page.reload();await page.locator('.resume-button').first().click();await expect(page.locator('#audio-toggle')).toBeEnabled()
  expect((await notes(page))[0].cfi).toBe(first.cfi);await expect.poll(()=>overlayColor(page)).toEqual([])
})
test('notebook combines books, edits another book and copies a quote with attribution',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.__copied=text},configurable:true})})
  await open(page);await select(page);await page.locator('#annotate-selection').click();await page.locator('#note-text').fill('Nota del primero');await page.locator('#save-note').click()
  await page.locator('#file-input').setInputFiles({name:'second.epub',mimeType:'application/epub+zip',buffer:await coverEPUB('Segundo libro')});await expect(page.locator('#opening-cover')).toBeVisible();await page.locator('#start-reading').click()
  await select(page);await page.locator('#annotate-selection').click();await page.locator('#note-text').fill('Nota del segundo');await page.locator('#save-note').click()
  await page.locator('#index-toggle').click();await page.getByRole('tab',{name:'Notas',exact:true}).click();await page.locator('#open-notebook').click();await expect(page.locator('.notebook-row')).toHaveCount(2)
  await page.locator('#notebook-search').fill('primero');await expect(page.locator('.notebook-row')).toHaveCount(1)
  await page.getByRole('button',{name:'Editar nota',exact:true}).last().click();await page.locator('#note-text').fill('Primero editado');await page.locator('#save-note').click()
  await expect(page.locator('.notebook-row')).toContainText('Primero editado');await expect(page.locator('#book-title')).toHaveText('Segundo libro')
  await page.getByRole('button',{name:'Copiar cita',exact:true}).last().click()
  expect(await page.evaluate(()=>window.__copied)).toContain('El jardín en silencio');expect(await page.evaluate(()=>window.__copied)).toContain('Ubicación')
})
test('exports use explicit destination, safe print HTML and no automatic downloads',async({page})=>{
  let downloads=0;page.on('download',()=>downloads++)
  await open(page);await select(page);await page.locator('#annotate-selection').click();await page.locator('#note-text').fill('<img src=x onerror=alert(1)> 注釈');await page.locator('#save-note').click()
  await page.locator('#index-toggle').click();await page.getByRole('tab',{name:'Notas',exact:true}).click();await page.locator('#export-notes').click()
  await expect(page.locator('#notes-export-preview')).toHaveValue(/sosiego/);expect(downloads).toBe(0)
  await page.evaluate(()=>{
    window.showSaveFilePicker=async options=>{window.__filename=options.suggestedName;return {createWritable:async()=>({write:async blob=>window.__saved=await blob.text(),close:async()=>{}})}}
    window.open=()=>({document:{write:html=>window.__printHTML=html,close(){}},focus(){},print(){window.__printed=true}})
  })
  await page.locator('#notes-export-save').click();await expect.poll(()=>page.evaluate(()=>window.__saved??'')).toContain('sosiego');expect(await page.evaluate(()=>window.__filename)).toBe('lector-notas.md')
  await page.locator('#notes-export-pdf').click();expect(await page.evaluate(()=>window.__printed)).toBe(true);expect(await page.evaluate(()=>window.__printHTML)).toContain('&lt;img');expect(await page.evaluate(()=>window.__printHTML)).not.toContain('<img')
  await page.evaluate(()=>window.showSaveFilePicker=undefined);await page.locator('#notes-export-save').click();await expect(page.locator('#notes-export-download')).toBeVisible();expect(downloads).toBe(0)
})
