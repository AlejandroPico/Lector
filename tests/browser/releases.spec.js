import { test, expect } from '@playwright/test'
import { epub, coverEPUB } from './fixtures.js'
import { readFile } from 'node:fs/promises'

async function open(page, text) {
  await page.goto('/')
  await page.locator('#file-input').setInputFiles(text ? {name:'voz.txt',mimeType:'text/plain',buffer:Buffer.from(text)}
    : {name:'libro.epub',mimeType:'application/epub+zip',buffer:await epub()})
  await expect(page.locator('#audio-toggle')).toBeEnabled()
  await expect(page.locator('#file-dialog')).toBeHidden()
}
async function mockSpeech(page) {
  await page.addInitScript(()=>{
    window.__spoken=[]
    Object.defineProperty(window,'speechSynthesis',{value:{
      getVoices:()=>[],addEventListener(){},cancel(){},pause(){},resume(){},
      speak(utterance){ window.__utterance=utterance; window.__spoken.push(utterance.text) },
    }})
  })
}
test('reading controls are centered and Play is circular on desktop',async ({page})=>{
  await open(page)
  const box=await page.locator('.toolbar-reading').boundingBox()
  expect(Math.abs(box.x+box.width/2-720)).toBeLessThan(2)
  await expect(page.locator('#audio-toggle')).toHaveCSS('border-radius','50%')
  await page.screenshot({path:'test-results/03-controls.png'})
})
test('a voice without word events advances at a page boundary inside a sentence',async ({page})=>{
  await mockSpeech(page)
  await page.setViewportSize({width:900,height:400})
  await open(page,Array.from({length:180},(_,i)=>`palabra${i}`).join(' ')+'.')
  await page.locator('#audio-toggle').click()
  await expect.poll(()=>page.evaluate(()=>window.__spoken.length)).toBe(1)
  const before=await page.evaluate(()=>document.querySelector('#reader').lastLocation.cfi)
  await page.evaluate(()=>window.__utterance.onend())
  await expect.poll(()=>page.evaluate(()=>window.__spoken.length)).toBe(2)
  await expect.poll(()=>page.evaluate(()=>document.querySelector('#reader').lastLocation.cfi)).not.toBe(before)
  const text=await page.evaluate(()=>window.__spoken.join(' '))
  expect(text).toMatch(/^palabra0 palabra1/)
  expect(text).not.toContain('palabra179')
})
test('clicking a word restarts there and tracking controls persist independently',async ({page})=>{
  await mockSpeech(page); await open(page)
  await page.locator('#audio-toggle').click()
  await expect.poll(()=>page.evaluate(()=>window.__spoken.length)).toBe(1)
  const point=await page.evaluate(()=>{
    const doc=document.querySelector('#reader').renderer.getContents()[0].doc
    const node=doc.querySelector('p').firstChild, offset=node.textContent.indexOf('umbral')
    const range=doc.createRange();range.setStart(node,offset);range.setEnd(node,offset+6)
    const rect=range.getBoundingClientRect(),frame=doc.defaultView.frameElement.getBoundingClientRect()
    return {x:frame.x+rect.x+rect.width/2,y:frame.y+rect.y+rect.height/2}
  })
  await page.mouse.click(point.x,point.y)
  await expect.poll(()=>page.evaluate(()=>window.__spoken.at(-1))).toMatch(/^umbral/)
  await page.locator('#voice-toggle').click()
  await page.locator('[data-setting="highlight"]').uncheck()
  await page.locator('[data-setting="followSpeech"]').uncheck()
  await page.locator('[data-setting="clickToRead"]').uncheck()
  await page.reload();await page.locator('#dismiss-file').click();await page.locator('#voice-toggle').click()
  for(const key of ['highlight','followSpeech','clickToRead']) await expect(page.locator(`[data-setting="${key}"]`)).not.toBeChecked()
})

test('personal themes preview, save, reload, import safely and remain user text',async ({page})=>{
  await open(page);await page.locator('#theme-toggle').click()
  await page.locator('#theme-editor > summary').click()
  await page.locator('#theme-name').fill('Mi noche personal')
  await page.locator('[data-theme-color="0"]').evaluate(input=>{input.value='#06080a';input.dispatchEvent(new Event('input',{bubbles:true}))})
  await page.locator('[data-theme-color="2"]').evaluate(input=>{input.value='#e7e8ea';input.dispatchEvent(new Event('input',{bubbles:true}))})
  await expect(page.locator('html')).toHaveCSS('background-color','rgb(6, 8, 10)')
  await page.getByRole('button',{name:'Guardar tema',exact:true}).click()
  await expect(page.locator('.theme-option')).toHaveCount(21)
  await page.screenshot({path:'test-results/04-themes.png'})
  await page.reload();await expect(page.locator('html')).toHaveCSS('background-color','rgb(6, 8, 10)')
  await page.locator('#dismiss-file').click();await page.locator('#theme-toggle').click()
  await expect(page.locator('button[data-theme^="personal-"]')).toContainText('Mi noche personal')
  await page.locator('#theme-editor > summary').click()
  await page.getByText('Importar o copiar tema',{exact:true}).click()
  await page.locator('#theme-json').fill('{"label":"Importado","colors":["url(javascript:alert(1))"]}')
  await page.locator('#theme-import').click();await expect(page.locator('.toast')).toContainText('ocho colores')
  await expect(page.locator('.theme-option')).toHaveCount(21)
  const theme=await page.evaluate(()=>JSON.parse(localStorage.getItem('lector-settings')).customThemes[0])
  await page.locator('#theme-json').fill(JSON.stringify({...theme,label:'Segunda paleta'}))
  await page.locator('#theme-import').click();await expect(page.locator('.theme-option')).toHaveCount(22)
  await page.locator('#theme-delete').click();await expect(page.locator('.theme-option')).toHaveCount(21)
})
test('margins and optional language hyphenation reach the ebook and persist',async ({page})=>{
  await open(page);await page.locator('#appearance-toggle').click()
  await expect(page.locator('[data-setting="hyphenate"]')).not.toBeChecked()
  for(const [key,value] of [['marginOuter','60'],['marginInner','42']]) {
    await page.locator(`[data-setting="${key}"]`).evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}))},value)
  }
  await page.locator('[data-setting="hyphenate"]').check()
  await expect(page.locator('#reading-area')).toHaveCSS('padding-left','60px')
  await expect.poll(()=>page.evaluate(()=>{
    const view=document.querySelector('#reader'),doc=view.renderer.getContents()[0].doc
    return [view.renderer.getAttribute('margin'),doc.defaultView.getComputedStyle(doc.querySelector('p')).hyphens,doc.documentElement.lang]
  })).toEqual(['42px','auto','es'])
  await page.reload();await page.locator('#dismiss-file').click();await page.locator('#appearance-toggle').click()
  await expect(page.locator('[data-setting="hyphenate"]')).toBeChecked()
  await expect(page.locator('[data-setting="marginOuter"]')).toHaveValue('60')
})
test('personal font loads into ebook, survives restart and can be removed',async ({page})=>{
  await open(page);await page.locator('#appearance-toggle').click()
  await page.getByText('Fuentes personales',{exact:true}).click()
  const buffer=await readFile(new URL('../../node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2',import.meta.url))
  await page.locator('#font-file').setInputFiles({name:'Mi-fuente.woff2',mimeType:'font/woff2',buffer})
  await expect(page.locator('#personal-fonts')).toContainText('Mi-fuente')
  const font=await page.locator('[data-setting="font"]').inputValue()
  expect(font).toMatch(/^personal-font-/)
  expect(await page.evaluate(async font=>{
    const doc=document.querySelector('#reader').renderer.getContents()[0].doc
    await doc.fonts.load(`21px "${font}"`)
    return [...doc.fonts].some(face=>face.family.replace(/["']/g,'')===font && face.status==='loaded')
  },font)).toBe(true)
  await page.reload();await page.locator('.resume-button').first().click()
  await expect(page.locator('#audio-toggle')).toBeEnabled();await page.locator('#appearance-toggle').click()
  await expect(page.locator('[data-setting="font"]')).toHaveValue(font)
  await page.getByText('Fuentes personales',{exact:true}).click();await page.getByRole('button',{name:'Eliminar fuente',exact:true}).click()
  await expect(page.locator('[data-setting="font"]')).toHaveValue('Georgia')
  await expect(page.locator('[data-setting="font"] option')).toHaveCount(20)
})

test('opening cover fills the reader, zooms and continues to text without repeating cover',async ({page})=>{
  await page.goto('/')
  await page.locator('#file-input').setInputFiles({name:'cubierta.epub',mimeType:'application/epub+zip',buffer:await coverEPUB()})
  await expect(page.locator('#file-dialog')).toBeHidden()
  await expect(page.locator('#opening-cover')).toBeVisible()
  const area=await page.locator('#reading-area').boundingBox(),image=await page.locator('#opening-cover-image').boundingBox()
  expect(image.height).toBeGreaterThan(area.height*.8)
  expect(Math.abs(image.x+image.width/2-area.x-area.width/2)).toBeLessThan(2)
  await page.screenshot({path:'test-results/05-cover.png'})
  await page.locator('#opening-cover-zoom').click();await expect(page.locator('#image-dialog')).toBeVisible()
  await page.locator('#image-dialog .dialog-close').click()
  await page.locator('#start-reading').click();await expect(page.locator('#opening-cover')).toBeHidden()
  await expect.poll(()=>page.evaluate(()=>document.querySelector('#reader').renderer.getContents()[0]?.doc.body.textContent??'')).toContain('El sosiego')
  await page.reload();await page.locator('.resume-button').first().click()
  await expect(page.locator('#audio-toggle')).toBeEnabled();await expect(page.locator('#opening-cover')).toBeHidden()
})
test('expanded library shares search and cover view with sidebar without losing collection',async ({page})=>{
  await page.goto('/')
  for(const title of ['El jardín en silencio','El jardín de invierno']) {
    await page.locator('#file-input').setInputFiles({name:`${title}.epub`,mimeType:'application/epub+zip',buffer:await coverEPUB(title)})
    await expect(page.locator('#opening-cover')).toBeVisible();await page.locator('#start-reading').click()
  }
  await page.locator('#index-toggle').click();await page.getByRole('tab',{name:'Libros',exact:true}).click()
  await expect(page.locator('.library-book')).toHaveCount(2)
  await page.locator('#library-view-covers').click();await expect(page.locator('.catalog-cover img')).toHaveCount(2)
  await page.locator('#library-expand').click();await expect(page.locator('#library-dialog')).toBeVisible()
  await expect(page.locator('#library-dialog .catalog-cover img')).toHaveCount(2)
  await page.screenshot({path:'test-results/05-library.png'})
  await page.locator('#library-search').fill('invierno');await expect(page.locator('.library-book')).toHaveCount(1)
  await page.locator('#library-dialog-close').click();await expect(page.locator('#library-dialog')).toBeHidden()
  await expect(page.locator('#library-tab #library-search')).toHaveValue('invierno')
  await page.locator('#library-search').fill('');await page.locator('#library-view-list').click()
  await expect(page.locator('.catalog-cover')).toHaveCount(0);await expect(page.locator('.library-book')).toHaveCount(2)
  await page.locator('#library-expand').click()
  await expect(page.locator('#library-dialog .catalog-cover img')).toHaveCount(2)
  await page.locator('#library-dialog .catalog-cover').first().click()
  await expect(page.locator('#library-dialog')).toBeHidden()
  await expect(page.locator('#book-title')).toHaveText('El jardín de invierno')
})
test('opening cover is optional and can be skipped when starting audio',async ({page})=>{
  await mockSpeech(page);await page.goto('/')
  const buffer=await coverEPUB()
  await page.locator('#file-input').setInputFiles({name:'audio.epub',mimeType:'application/epub+zip',buffer})
  await expect(page.locator('#opening-cover')).toBeVisible();await page.locator('#audio-toggle').click()
  await expect(page.locator('#opening-cover')).toBeHidden()
  await expect.poll(()=>page.evaluate(()=>window.__spoken.length)).toBe(1)
  expect(await page.evaluate(()=>window.__spoken[0])).not.toContain('Cubierta')
  await page.locator('#audio-toggle').click();await page.locator('#preferences-toggle').click()
  await page.locator('#preferences-panel summary').filter({hasText:'Apariencia'}).click()
  await page.locator('[data-setting="showOpeningCover"]').uncheck()
  await page.locator('#file-input').setInputFiles({name:'otro.epub',mimeType:'application/epub+zip',buffer:await coverEPUB('Otra novela')})
  await expect(page.locator('#loading')).toBeHidden()
  await expect(page.locator('#audio-toggle')).toBeEnabled();await expect(page.locator('#opening-cover')).toBeHidden()
  await expect.poll(()=>page.evaluate(()=>document.querySelector('#reader').renderer.getContents()[0]?.doc.body.textContent??'')).toContain('El sosiego')
})

test('mobile cover and expanded library fit the screen and use the chosen language',async ({browser})=>{
  const context=await browser.newContext({locale:'fr-FR',viewport:{width:390,height:844},baseURL:'http://127.0.0.1:5177'})
  const page=await context.newPage();await page.goto('/')
  await page.locator('#file-input').setInputFiles({name:'mobile.epub',mimeType:'application/epub+zip',buffer:await coverEPUB()})
  await expect(page.locator('#opening-cover')).toBeVisible()
  await expect(page.locator('#start-reading')).toContainText('Commencer à lire')
  await page.locator('#preferences-toggle').click();await page.locator('#preferences-panel summary').filter({hasText:'Bibliothèque'}).click()
  await page.locator('[data-settings-tab="library"]').click();await expect(page.locator('#library-dialog')).toBeVisible()
  await expect(page.locator('#library-dialog .catalog-cover img')).toHaveCount(1)
  const box=await page.locator('#library-dialog').boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390)
  await page.screenshot({path:'test-results/05-mobile-library.png'})
  await context.close()
})
