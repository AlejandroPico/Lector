import { test, expect } from '@playwright/test'
import { epub, mobi } from './fixtures.js'

async function openBook(page) {
  await page.goto('/')
  await page.locator('#file-input').setInputFiles({ name:'test.epub',mimeType:'application/epub+zip',buffer:await epub() })
  await expect(page.locator('#file-dialog')).toBeHidden()
  await expect(page.locator('#audio-toggle')).toBeEnabled()
}

test('theme background stays uniform through resizing, animation and columns', async ({page}) => {
  await openBook(page)
  await page.locator('#theme-toggle').click()
  await expect(page.locator('button[data-theme]')).toHaveCount(20)
  await page.locator('button[data-theme="contrast"]').click()
  await expect(page.locator('html')).toHaveCSS('background-color','rgb(0, 0, 0)')
  await page.locator('#appearance-toggle').click()
  for (const count of ['1','2','3']) {
    await page.locator('[data-setting="columns"]').selectOption(count)
    await page.locator('[data-setting="animated"]').uncheck()
    await page.locator('[data-setting="animated"]').check()
    await expect.poll(()=>page.evaluate(()=>{
      const view=document.querySelector('#reader'), doc=view.renderer.getContents()[0]?.doc
      if (!doc?.body) return null
      const style=doc.defaultView.getComputedStyle(doc.documentElement)
      const frame=doc.defaultView.getComputedStyle(doc.defaultView.frameElement)
      return {theme:style.getPropertyValue('--theme-bg-color').trim(),frame:frame.backgroundColor,border:frame.borderWidth}
    })).toEqual({theme:'#000000',frame:'rgb(0, 0, 0)',border:'0px'})
  }
  await page.keyboard.press('Escape')
  await page.screenshot({path:'test-results/contraste.png'})
})

test('twenty fonts include real local reading fonts and wide screen control', async ({page}) => {
  await page.setViewportSize({width:2560,height:1080})
  await openBook(page); await page.locator('#appearance-toggle').click()
  await expect(page.locator('[data-setting="font"] option')).toHaveCount(20)
  await page.locator('[data-setting="columns"]').selectOption('3')
  await page.locator('[data-setting="fullWidth"]').check()
  await expect(page.locator('#reading-area')).toHaveCSS('max-width','none')
  await expect.poll(()=>page.evaluate(()=>document.querySelector('#reader').renderer.columnCount)).toBe(3)
  for (const family of ['Atkinson Hyperlegible','Lexend']) {
    await page.locator('[data-setting="font"]').selectOption(family)
    expect(await page.evaluate(async family=>{
      const doc=document.querySelector('#reader').renderer.getContents()[0].doc
      await doc.fonts.load(`21px "${family}"`)
      return [...doc.fonts].some(font=>font.family.replace(/["']/g,'')===family && font.status==='loaded')
    },family)).toBe(true)
  }
})

test('zen explains its exit only on the first activation', async ({page}) => {
  await openBook(page)
  await page.locator('#zen-toggle').click(); await expect(page.locator('#zen-hint')).toBeVisible()
  await expect(page.locator('#zen-hint')).toContainText('Esc')
  await page.locator('#dismiss-zen-hint').click(); await expect(page.locator('#zen-hint')).toBeHidden()
  await page.keyboard.press('Escape'); await page.locator('#zen-toggle').click()
  await expect(page.locator('#zen-hint')).toBeHidden()
})

test('image wheel zoom, dragging, fit and pinch work', async ({page}) => {
  await openBook(page)
  await page.locator('#index-toggle').click(); await page.getByRole('button',{name:'El regreso',exact:true}).click()
  await page.locator('#show-cover').click(); await expect(page.locator('#image-dialog')).toBeVisible()
  await expect.poll(()=>page.locator('#zoom-image').evaluate(image=>image.width)).toBeGreaterThan(20)
  await page.locator('.image-stage').hover(); await page.mouse.wheel(0,-300)
  await expect.poll(()=>page.locator('#zoom-level').textContent()).not.toBe('100 %')
  await page.locator('#zoom-fit').click(); await expect(page.locator('#zoom-level')).toHaveText('100 %')
  for(let i=0;i<8;i++) await page.locator('#zoom-in').click()
  const stage=page.locator('.image-stage'), box=await stage.boundingBox()
  await stage.evaluate(el=>{el.scrollLeft=100;el.scrollTop=100})
  const before=await stage.evaluate(el=>el.scrollTop)
  await page.mouse.move(box.x+150,box.y+150); await page.mouse.down()
  await page.mouse.move(box.x+180,box.y+250); await page.mouse.up()
  expect(await stage.evaluate(el=>el.scrollTop)).toBeLessThan(before)
  await page.locator('#zoom-fit').click()
  await stage.dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch',clientX:100,clientY:100,button:0})
  await stage.dispatchEvent('pointerdown',{pointerId:2,pointerType:'touch',clientX:200,clientY:100,button:0})
  await stage.dispatchEvent('pointermove',{pointerId:2,pointerType:'touch',clientX:300,clientY:100,button:0})
  await expect(page.locator('#zoom-level')).toHaveText('200 %')
})

for (const [locale,expected] of [['ca-ES','Obrir un llibre'],['en-US','Open a book'],['fr-FR','Ouvrir un livre'],['de-DE','Buch öffnen'],['pt-PT','Abrir um livro'],['it-IT','Apri un libro'],['zh-CN','打开书籍'],['ja-JP','本を開く'],['hi-IN','पुस्तक खोलें']]) {
  test(`automatically detects ${locale}`,async ({browser})=>{
    const context=await browser.newContext({locale}),page=await context.newPage()
    await page.goto('http://127.0.0.1:5177/')
    await expect(page.getByRole('button',{name:expected,exact:true})).toBeVisible()
    await context.close()
  })
}

test('language switch persists and does not translate book titles or text',async ({page})=>{
  await openBook(page)
  await page.locator('#preferences-toggle').click()
  await page.locator('[data-setting="uiLanguage"]').selectOption('en')
  await expect(page.locator('#preferences-title')).toHaveText('Settings')
  await expect(page.locator('#appearance-toggle')).toHaveAttribute('aria-label','Typography and page')
  expect(await page.evaluate(()=>document.querySelector('#reader').renderer.getContents()[0].doc.body.textContent)).toContain('El sosiego')
  await page.locator('[data-setting="uiLanguage"]').selectOption('ja')
  await expect(page.locator('#preferences-title')).toHaveText('設定')
  await page.reload(); await expect(page.getByRole('button',{name:'本を開く',exact:true})).toBeVisible()
})

test('Calibre folder enumeration does not read books, covers or metadata until selected',async ({page})=>{
  await page.goto('/')
  const payload=(await epub()).toString('base64')
  const mobiPayload=mobi().toString('base64')
  await page.evaluate(async ({payload,mobiPayload})=>{
    const root=await navigator.storage.getDirectory()
    const library=await root.getDirectoryHandle('Biblioteca',{create:true})
    const author=await library.getDirectoryHandle('Autor A',{create:true})
    const write=async (folder,name,data)=>{const handle=await folder.getFileHandle(name,{create:true});const stream=await handle.createWritable();await stream.write(data);await stream.close()}
    const decode=base64=>Uint8Array.from(atob(base64),c=>c.charCodeAt(0))
    for (const [name,id] of [['Jardín',1],['Otro libro',2]]) {
      const folder=await author.getDirectoryHandle(`${name} (${id})`,{create:true})
      await write(folder,`${name}.epub`,decode(payload))
      await write(folder,`${name}.mobi`,decode(mobiPayload))
      await write(folder,'metadata.opf',`<package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>Título personalizado ${id}</dc:title><dc:creator>Autora personalizada</dc:creator></metadata></package>`)
      await write(folder,'cover.svg','<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#abc"/></svg>')
    }
    window.__fileReads=[]
    const getFile=FileSystemFileHandle.prototype.getFile
    FileSystemFileHandle.prototype.getFile=function(){window.__fileReads.push(this.name);return getFile.call(this)}
    window.showDirectoryPicker=async()=>library
  },{payload,mobiPayload})
  await page.locator('#choose-folder').click()
  await expect(page.locator('#folder-progress')).toBeHidden()
  await expect(page.locator('#library-count')).toContainText('2 libros')
  expect(await page.evaluate(()=>window.__fileReads)).toEqual([])
  await expect(page.locator('.library-book')).toHaveCount(2)
  await page.locator('[data-setting="libraryView"]').selectOption('covers')
  expect(await page.evaluate(()=>window.__fileReads)).toEqual([])
  await page.getByRole('button',{name:'Leer metadatos',exact:true}).first().click()
  await expect(page.getByRole('button',{name:'Título personalizado 1',exact:true})).toBeVisible()
  expect(await page.evaluate(()=>window.__fileReads)).toEqual(['metadata.opf'])
  await page.getByRole('button',{name:'Título personalizado 1',exact:true}).click()
  await expect(page.locator('#audio-toggle')).toBeEnabled()
  expect(await page.evaluate(()=>window.__fileReads)).toEqual(['metadata.opf','Jardín.epub'])
  await page.reload(); await expect(page.locator('.resume-button')).toHaveCount(1)
  await page.locator('#dismiss-file').click();await page.locator('#index-toggle').click();await page.getByRole('tab',{name:'Libros',exact:true}).click()
  await expect(page.locator('#library-count')).toContainText('2 libros')
})
