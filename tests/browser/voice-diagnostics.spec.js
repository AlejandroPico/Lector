import {test,expect} from '@playwright/test'
test.setTimeout(90000)
async function mock(page){await page.addInitScript(()=>{
 window.__calls=[];window.__cancels=0;window.__hold=false;window.__speaking=false
 window.__voiceList=[{name:'Buena España',voiceURI:'good',lang:'es-ES',localService:true},{name:'Fallida España',voiceURI:'bad',lang:'es-ES',localService:false},{name:'English voice',voiceURI:'english',lang:'en-US',localService:true},{name:'Voz México',voiceURI:'mexico',lang:'es-MX',localService:false}]
 window.SpeechSynthesisUtterance=class {constructor(text){this.text=text}}
 Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>window.__voiceList,addEventListener(){},get speaking(){return window.__speaking},get pending(){return false},pause(){window.__paused=true},resume(){window.__paused=false},cancel(){window.__cancels++;window.__speaking=false;window.__last?.onerror?.({error:'canceled'})},speak(u){
   window.__calls.push({voice:u.voice?.voiceURI,lang:u.lang,text:u.text});window.__last=u;window.__late=u.onend;window.__speaking=true;u.onstart?.()
   if(!window.__hold)setTimeout(()=>{window.__speaking=false;u.voice?.voiceURI==='bad'?u.onerror?.({error:'synthesis-failed'}):u.onend?.()},30)
 }}})
})}
async function open(page,{book=false}={}){
 await mock(page);await page.goto('/')
 if(book){await page.locator('#file-input').setInputFiles({name:'original.txt',mimeType:'text/plain',buffer:Buffer.from('La tarde caía despacio. Todo quedó en silencio. Otro párrafo más largo. Otra frase.')});await expect(page.locator('#audio-toggle')).toBeEnabled()}
 else await page.locator('#dismiss-file').click()
}
async function diagnostics(page){await page.locator('#voice-toggle').click();await page.locator('#voice-diagnostics-open').click();await expect(page.locator('#voice-diagnostics-dialog')).toBeVisible()}

test('opening diagnostics is silent; exact regional voices report individual results without changing selection',async({page})=>{
 await open(page);await page.locator('#voice-toggle').click();await page.locator('#browser-voices').selectOption('good');await page.locator('#voice-diagnostics-open').click()
 expect(await page.evaluate(()=>window.__calls)).toEqual([]);await expect(page.locator('#voice-diagnostics-language')).toHaveValue('es-ES')
 await page.locator('#voice-diagnostics-run').click();await expect(page.locator('#voice-diagnostics-progress')).toHaveText('2 / 2')
 await expect(page.locator('#voice-diagnostics-list')).toContainText('Sin error comunicado');await expect(page.locator('#voice-diagnostics-list')).toContainText('Fallo (synthesis-failed)')
 expect(await page.evaluate(()=>window.__calls.map(v=>[v.voice,v.lang]))).toEqual([['good','es-ES'],['bad','es-ES']])
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('lector-settings')).voice)).toBe('good')
 await page.screenshot({path:'test-results/25-voice-diagnostics.png'});await page.locator('#voice-diagnostics-close').click();await diagnostics(page)
 await expect(page.locator('#voice-diagnostics-list')).toContainText('synthesis-failed')
})

test('language filters test only visible selected voices and accept a confirmed sample',async({page})=>{
 await open(page);await diagnostics(page);await page.locator('#voice-diagnostics-language').selectOption('en-US');await expect(page.locator('#voice-diagnostics-run')).toBeDisabled()
 await page.locator('#voice-diagnostics-all').click();await page.locator('#voice-diagnostics-text').fill('A short confirmed sample.');await page.locator('#voice-diagnostics-run').click()
 await expect(page.locator('#voice-diagnostics-progress')).toHaveText('1 / 1')
 expect(await page.evaluate(()=>window.__calls)).toEqual([{voice:'english',lang:'en-US',text:'A short confirmed sample.'}])
})

test('active and paused narration remain untouched when diagnostics are requested',async({page})=>{
 await open(page,{book:true});await page.evaluate(()=>window.__hold=true);await page.locator('#audio-toggle').click();await expect.poll(()=>page.evaluate(()=>window.__calls.length)).toBe(1)
 const before=await page.evaluate(()=>window.__cancels);await diagnostics(page);await page.locator('#voice-diagnostics-run').click()
 await expect(page.locator('#voice-diagnostics-error')).toContainText('Detén la lectura');expect(await page.evaluate(()=>window.__cancels)).toBe(before);expect(await page.evaluate(()=>window.__calls.length)).toBe(1)
 await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-label','Pausar lectura');await page.locator('#voice-diagnostics-close').click();await page.locator('#audio-toggle').click();await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-label','Continuar lectura')
 await diagnostics(page);await page.locator('#voice-diagnostics-run').click();await expect(page.locator('#voice-diagnostics-error')).toContainText('Detén la lectura');expect(await page.evaluate(()=>window.__cancels)).toBe(before)
})

test('cancel closes the current sample, ignores late callbacks and allows normal reading afterwards',async({page})=>{
 await open(page,{book:true});await page.evaluate(()=>window.__hold=true);await diagnostics(page);await page.locator('#voice-diagnostics-run').click()
 await expect.poll(()=>page.evaluate(()=>window.__calls.length)).toBe(1);await page.keyboard.press('MediaPlayPause');await expect(page.locator('#toast')).toContainText('Cancela la prueba')
 expect(await page.evaluate(()=>window.__calls.length)).toBe(1);await page.locator('#voice-diagnostics-cancel').click();await expect(page.locator('#voice-diagnostics-list')).toContainText('Cancelada')
 await page.evaluate(()=>window.__late?.());expect(await page.evaluate(()=>window.__calls.length)).toBe(1)
 await page.locator('#voice-diagnostics-close').click();await page.locator('#audio-toggle').click();await expect.poll(()=>page.evaluate(()=>window.__calls.length)).toBe(2)
})

test('closing a running diagnostic stops it and empty inventories never start a sample',async({page})=>{
 await open(page);await page.evaluate(()=>window.__hold=true);await diagnostics(page);await page.locator('#voice-diagnostics-run').click();await expect.poll(()=>page.evaluate(()=>window.__calls.length)).toBe(1)
 const before=await page.evaluate(()=>window.__cancels);await page.keyboard.press('Escape');await expect(page.locator('#voice-diagnostics-dialog')).toBeHidden();await expect.poll(()=>page.evaluate(()=>window.__cancels)).toBe(before+1)
 await page.evaluate(()=>window.__voiceList=[]);await diagnostics(page);await expect(page.locator('#voice-diagnostics-run')).toBeDisabled();await expect(page.locator('#voice-diagnostics-list')).toContainText('No hay voces disponibles')
 expect(await page.evaluate(()=>window.__calls.length)).toBe(1)
})

test('diagnostics fit mobile and translate controls without changing voice names',async({browser})=>{
 const context=await browser.newContext({locale:'en-US',viewport:{width:390,height:844},baseURL:'http://127.0.0.1:5177'}),page=await context.newPage()
 await open(page);await diagnostics(page);await expect(page.locator('#voice-diagnostics-title')).toHaveText('Voice diagnostics');await expect(page.locator('#voice-diagnostics-language')).toHaveValue('en-US')
 await expect(page.locator('#voice-diagnostics-text')).toHaveValue('Evening fell slowly. For a moment, everything went quiet.')
 await expect(page.locator('#voice-diagnostics-list')).toContainText('English voice');expect(await page.evaluate(()=>window.__calls)).toEqual([])
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);expect(await page.locator('#voice-diagnostics-dialog').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false)
 await page.screenshot({path:'test-results/25-mobile-diagnostics.png'});await context.close()
})
