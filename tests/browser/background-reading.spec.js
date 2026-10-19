import {test,expect} from '@playwright/test'
import {epub} from './fixtures.js'

async function openNativeReading(page){
 await page.addInitScript(()=>{
  if(window!==window.top)return
  const native=window.__native={starts:0,pauses:0,resumes:0,rewinds:0}
  let active,resolve
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
   getVoices:()=>[{voiceURI:'test-es',lang:'es-ES',name:'Voz del dispositivo',default:true}],addEventListener(){},
   cancel(){active=false;resolve?.();resolve=null},
   startQueue(options,callbacks){active=true;native.starts++;native.options=options;native.events=callbacks;return new Promise(done=>{resolve=done;native.finish=done})},
   pause(){native.pauses++;if(active)native.events.onState('paused')},resume(){native.resumes++;if(active)native.events.onState('playing')},
   rewind:async options=>{native.rewinds++;native.rewindOptions=options},
   configure:async options=>{native.configuration=options},
  }})
 })
 await page.goto('/');await page.locator('#file-input').setInputFiles({name:'libro.epub',mimeType:'application/epub+zip',buffer:await epub()})
 await expect(page.locator('#audio-toggle')).toBeEnabled();await page.locator('#audio-toggle').click()
 await expect.poll(()=>page.evaluate(()=>window.__native.starts)).toBe(1)
}

test('Android receives all sentences and chapters before playback and retains its queue while browsing',async({page})=>{
 await openNativeReading(page)
 const data=await page.evaluate(()=>({items:window.__native.options.items,book:window.__native.options.bookId}))
 expect(data.book).toBeTruthy();expect(data.items.length).toBeGreaterThan(100);expect(data.items[0].chapter).toBe('El jardín');expect(data.items.some(item=>item.chapter==='La ventana')).toBe(true);expect(data.items.at(-1).chapter).toBe('El regreso')
 expect(data.items.every(item=>item.text.length<=3000&&item.cfi.startsWith('epubcfi(')&&item.voice==='test-es')).toBe(true)
 await page.locator('#appearance-toggle').click();await page.locator('[data-setting="columns"]').selectOption('1');await page.keyboard.press('Escape');await page.locator('#next-page').click()
 await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-label','Pausar lectura');expect(await page.evaluate(()=>window.__native.starts)).toBe(1)
 await page.locator('#audio-toggle').click();await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-label','Continuar lectura');expect(await page.evaluate(()=>window.__native.pauses)).toBe(1)
 await page.locator('#audio-toggle').click();await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-label','Pausar lectura');expect(await page.evaluate(()=>window.__native.resumes)).toBe(1)
})

test('a native snapshot restores the current word and UI after notification controls',async({page})=>{
 await openNativeReading(page)
 await page.evaluate(()=>{const n=window.__native,index=n.options.items.findIndex(item=>item.chapter==='El regreso');n.events.onPosition({item:index,charIndex:0,charLength:2});n.events.onState('paused')})
 await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-label','Continuar lectura')
 await expect.poll(()=>page.locator('#chapter-name').textContent()).toBe('El regreso')
 const errors=[];page.on('pageerror',error=>errors.push(error.message))
 await page.evaluate(()=>window.__native.events.onState('playing'));await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-label','Pausar lectura')
 await expect.poll(()=>page.evaluate(()=>{const doc=document.querySelector('#reader').renderer.getContents()[0].doc;return doc.defaultView.CSS.highlights.get('spoken')?.values().next().value?.toString()})).toBe('El')
 expect(errors).toEqual([])
})

test('native snapshots persist progress without dragging manually browsed pages back',async({page})=>{
 await openNativeReading(page);await page.locator('#next-page').click();const before=await page.locator('#progress-text').textContent()
 await page.evaluate(()=>{const n=window.__native,item=n.options.items.length-2;n.events.onPosition({item,charIndex:0,charLength:2})})
 await expect(page.locator('#progress-text')).toHaveText(before);await expect(page.locator('#return-reading')).toBeVisible()
 await page.locator('#return-reading').click();await expect.poll(()=>page.locator('#chapter-name').textContent()).toBe('El regreso')
 expect(await page.evaluate(()=>window.__native.starts)).toBe(1)
})

test('voice speed and sleep controls reach the native queue without restarting narration',async({page})=>{
 await openNativeReading(page);await page.locator('#voice-toggle').click()
 await page.locator('[data-setting="rate"]').evaluate(input=>{input.value='1.2';input.dispatchEvent(new Event('input',{bubbles:true}))})
 await expect.poll(()=>page.evaluate(()=>window.__native.configuration.characters.narrator.rate)).toBe(1.2)
 await expect(page.locator('#audio-rewind')).toBeEnabled();await page.locator('#audio-rewind').click();expect(await page.evaluate(()=>window.__native.rewindOptions.seconds)).toBe(0)
 await page.getByText('Temporizador y retroceso',{exact:true}).click()
 await page.locator('[data-setting="rewindMode"]').selectOption('seconds');await page.locator('[data-setting="rewindSeconds"]').fill('20');await page.locator('[data-setting="rewindSeconds"]').press('Tab');await page.locator('#audio-rewind').click();expect(await page.evaluate(()=>window.__native.rewindOptions.seconds)).toBe(20)
 await page.locator('[data-setting="sleepEnabled"]').check();await expect.poll(()=>page.evaluate(()=>window.__native.configuration.deadline)).toBeGreaterThan(Date.now())
 await page.locator('[data-setting="sleepEnabled"]').uncheck();await expect.poll(()=>page.evaluate(()=>window.__native.configuration.deadline)).toBe(0)
 expect(await page.evaluate(()=>window.__native.starts)).toBe(1);await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-label','Pausar lectura')
 await page.evaluate(()=>window.__native.finish());await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-label','Leer en voz alta');await expect(page.locator('#audio-rewind')).toBeDisabled()
})
