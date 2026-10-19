import {test,expect} from '@playwright/test'
const original='El sosiego de la tarde acompañaba a Elena. Otra frase privada.\n\nLlegaron al umbral.\n\nLa mañana volvió.'
const translated='An extra preface.\n\nThe peace of the evening accompanied Elena. Another private sentence.\n\nThey reached the threshold.\n\nMorning returned.'
async function open(page){await page.goto('/');await page.locator('#file-input').setInputFiles({name:'original.txt',mimeType:'text/plain',buffer:Buffer.from(original)});await expect(page.locator('#audio-toggle')).toBeEnabled()}
async function languageSettings(page){await page.locator('#preferences-toggle').click();await page.locator('#settings-search').fill('contexto');await expect(page.locator('#language-settings')).toBeVisible()}
async function bilingual(page){await languageSettings(page);await page.locator('#settings-bilingual').click();await expect(page.locator('#bilingual-dialog')).toBeVisible();await expect(page.locator('#bilingual-progress')).toBeHidden()}
async function selectWord(page,word='sosiego'){
  await page.evaluate(word=>{const doc=document.querySelector('#reader').renderer.getContents()[0].doc,node=doc.querySelector('p').firstChild,index=node.textContent.indexOf(word),range=doc.createRange();range.setStart(node,index);range.setEnd(node,index+word.length);const selection=doc.defaultView.getSelection();selection.removeAllRanges();selection.addRange(range);doc.dispatchEvent(new doc.defaultView.PointerEvent('pointerup',{bubbles:true}))},word)
  await expect(page.locator('#selection-menu')).toBeVisible()
}

test('context previews are local by default and preserve a distinct dictionary definition',async({page})=>{
  const external=[];page.on('request',request=>{if(/^https:\/\//.test(request.url()))external.push(request.url())})
  await open(page);await selectWord(page);await page.locator('#context-selection').click()
  await expect(page.locator('#context-fragment')).toHaveValue('El sosiego de la tarde acompañaba a Elena.')
  await expect(page.locator('#context-word')).toHaveValue('sosiego')
  await expect(page.locator('#context-run')).toBeDisabled();await expect(page.locator('#context-dictionary')).toBeVisible()
  await expect(page.locator('#context-answer')).toBeHidden();expect(external).toEqual([])
})

test('a configured API receives only the confirmed passage, uses safe text and never persists its key',async({page})=>{
  const requests=[]
  await page.route('https://context.example/v1/chat/completions',async route=>{requests.push({body:route.request().postDataJSON(),headers:route.request().headers()});await route.fulfill({json:{choices:[{message:{content:'Aquí significa tranquilidad. <img src="https://tracker.invalid/pixel">'}}]}})})
  await open(page);await languageSettings(page)
  await page.locator('#context-provider').selectOption('chat');await page.locator('#context-endpoint').fill('https://context.example/v1/chat/completions');await page.locator('#context-model').fill('test-model');await page.locator('#context-key').fill('only-this-session');await page.keyboard.press('Escape')
  await selectWord(page);await page.locator('#context-selection').click();expect(requests).toEqual([])
  await page.locator('#context-run').click();await expect(page.locator('#context-result')).toContainText('tranquilidad')
  expect(requests).toHaveLength(1);expect(requests[0].headers.authorization).toBe('Bearer only-this-session')
  expect(JSON.parse(requests[0].body.messages[1].content).passage).toBe('El sosiego de la tarde acompañaba a Elena.')
  expect(JSON.stringify(requests[0].body)).not.toContain('Otra frase privada');expect(JSON.stringify(requests[0].body)).not.toContain('umbral')
  await expect(page.locator('#context-result img')).toHaveCount(0)
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain('only-this-session')
  await page.reload();await page.locator('#dismiss-file').click();await languageSettings(page);await expect(page.locator('#context-key')).toHaveValue('')
})

test('bilingual paragraphs and manual offset persist without sending or replacing the original',async({page})=>{
  const external=[];page.on('request',request=>{if(/^https:\/\//.test(request.url()))external.push(request.url())})
  await open(page);await bilingual(page);await page.locator('#bilingual-file').setInputFiles({name:'translation.txt',mimeType:'text/plain',buffer:Buffer.from(translated)})
  await expect(page.locator('.bilingual-translation').first()).toHaveText('An extra preface.')
  await page.locator('#bilingual-adjust').click();await page.locator('#bilingual-language').selectOption('en');await page.locator('#bilingual-offset').fill('1');await page.locator('#bilingual-offset').press('Tab')
  await expect(page.locator('[data-original-paragraph="0"] .bilingual-translation')).toContainText('The peace')
  await expect(page.locator('[data-original-paragraph="1"] .bilingual-translation')).toHaveText('They reached the threshold.')
  await page.locator('#bilingual-adjust').click();await page.screenshot({path:'test-results/11-bilingual.png'})
  await page.reload();await page.locator('.resume-button').first().click();await expect(page.locator('#audio-toggle')).toBeEnabled();await bilingual(page)
  await expect(page.locator('[data-original-paragraph="0"] .bilingual-translation')).toContainText('The peace')
  await expect(page.locator('[data-original-paragraph="1"] .bilingual-original')).toHaveText('Llegaron al umbral.')
  await expect(page.locator('#bilingual-language')).toHaveValue('en');expect(external).toEqual([])
})

test('paragraph links can skip a paragraph, reset and return to a stable original position',async({page})=>{
  await open(page);await bilingual(page);await page.locator('#bilingual-file').setInputFiles({name:'translation.txt',mimeType:'text/plain',buffer:Buffer.from(translated)})
  await expect(page.locator('.bilingual-translation').first()).toHaveText('An extra preface.')
  await page.locator('#bilingual-adjust').click();await page.locator('#bilingual-source-paragraph').selectOption('0');await page.locator('#bilingual-target-paragraph').fill('0');await page.locator('#bilingual-pair').click()
  await expect(page.locator('[data-original-paragraph="0"] .bilingual-translation')).toHaveText('—')
  await page.locator('#bilingual-reset').click();await expect(page.locator('[data-original-paragraph="0"] .bilingual-translation')).toHaveText('An extra preface.')
  await page.locator('#bilingual-adjust').click();await page.locator('[data-original-paragraph="1"] .bilingual-jump').focus();await page.locator('[data-original-paragraph="1"] .bilingual-jump').click()
  await expect(page.locator('#bilingual-dialog')).toBeHidden();await expect(page.locator('#audio-toggle')).toBeEnabled()
  expect(await page.evaluate(()=>document.querySelector('#reader').lastLocation.cfi)).toMatch(/^epubcfi\(/)
})

test('translation storage is optional, survives within a session and can be removed alone',async({page})=>{
  await open(page);await bilingual(page);await page.locator('#bilingual-file').setInputFiles({name:'translation.txt',mimeType:'text/plain',buffer:Buffer.from(translated)})
  await expect(page.locator('.bilingual-translation').first()).toHaveText('An extra preface.')
  await page.locator('#bilingual-adjust').click();await page.locator('#bilingual-remember').uncheck()
  await expect.poll(()=>page.evaluate(async()=>{const {allBooks,getTranslation}=await import('/src/storage.js');return Boolean((await getTranslation((await allBooks())[0].id))?.file)})).toBe(false)
  await page.locator('#bilingual-dialog .dialog-close').click()
  await page.locator('#file-input').setInputFiles({name:'second.txt',mimeType:'text/plain',buffer:Buffer.from('Otro libro diferente.')});await expect(page.locator('#book-title')).toHaveText('second');await bilingual(page)
  await expect(page.locator('#bilingual-empty')).toBeVisible();await page.locator('#bilingual-dialog .dialog-close').click()
  await page.locator('#file-input').setInputFiles({name:'original.txt',mimeType:'text/plain',buffer:Buffer.from(original)});await expect(page.locator('#book-title')).toHaveText('original');await bilingual(page)
  await expect(page.locator('.bilingual-translation').first()).toHaveText('An extra preface.')
  await page.locator('#bilingual-remove').click();await expect(page.locator('#bilingual-empty')).toBeVisible()
  expect(await page.evaluate(async()=>{const {allBooks,getTranslation}=await import('/src/storage.js');const books=await allBooks();return {books:books.length,translation:await getTranslation(books.find(book=>book.title==='original').id)}})).toEqual({books:2,translation:undefined})
})

test('mobile bilingual reading fits and translates its controls without translating either book',async({browser})=>{
  const context=await browser.newContext({locale:'en-US',viewport:{width:390,height:844},baseURL:'http://127.0.0.1:5177'}),page=await context.newPage()
  await open(page);await page.locator('#preferences-toggle').click();await page.locator('#settings-search').fill('bilingual');await page.locator('#settings-bilingual').click()
  await expect(page.locator('#bilingual-title')).toHaveText('Bilingual reading');await page.locator('#bilingual-file').setInputFiles({name:'translation.txt',mimeType:'text/plain',buffer:Buffer.from(translated)})
  await expect(page.locator('.bilingual-original').first()).toContainText('El sosiego');await expect(page.locator('.bilingual-translation').first()).toHaveText('An extra preface.')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390)
  expect(await page.locator('#bilingual-dialog').evaluate(element=>element.scrollWidth>element.clientWidth)).toBe(false)
  await page.screenshot({path:'test-results/11-mobile-bilingual.png'});await context.close()
})

test('local Ollama requests can be canceled and late replies cannot replace a newer result',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('lector-language-tools',JSON.stringify({provider:'ollama',endpoint:'http://127.0.0.1:11434/api/chat',model:'installed-model'})))
  const requests=[]
  await page.route('http://127.0.0.1:11434/api/chat',async route=>{
    requests.push({body:route.request().postDataJSON(),headers:route.request().headers()});const index=requests.length
    if(index===1)await new Promise(resolve=>setTimeout(resolve,350))
    await route.fulfill({json:{message:{content:index===1?'Respuesta anterior':'Respuesta actual'}}}).catch(()=>{})
  })
  await open(page);await selectWord(page);await page.locator('#context-selection').click();await page.locator('#context-run').click()
  await expect.poll(()=>requests.length).toBe(1);await page.locator('#context-cancel').click();await expect(page.locator('#context-error')).toHaveText('Consulta cancelada')
  await page.locator('#context-run').click();await expect(page.locator('#context-result')).toHaveText('Respuesta actual')
  expect(requests[1].headers.authorization).toBeUndefined();expect(requests[1].body).toMatchObject({stream:false,options:{num_predict:700}})
  await page.waitForTimeout(400);await expect(page.locator('#context-result')).toHaveText('Respuesta actual')
})

test('bilingual narration highlights the original word and allows disabling following',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],addEventListener(){},cancel(){},pause(){},resume(){},speak(utterance){window.__utterance=utterance;utterance.onstart?.()}}}))
  await open(page);await bilingual(page);await page.locator('#bilingual-file').setInputFiles({name:'translation.txt',mimeType:'text/plain',buffer:Buffer.from(translated)})
  await expect(page.locator('.bilingual-translation').first()).toHaveText('An extra preface.');await page.locator('#bilingual-audio').click()
  await expect.poll(()=>page.evaluate(()=>Boolean(window.__utterance))).toBe(true)
  await page.evaluate(()=>{const utterance=window.__utterance;utterance.onboundary({name:'word',charIndex:utterance.text.indexOf('sosiego'),charLength:7})})
  await expect(page.locator('[data-original-paragraph="0"]')).toHaveClass(/current/)
  expect(await page.evaluate(()=>[...CSS.highlights.get('parallel-spoken')][0].toString())).toBe('sosiego')
  await page.locator('#bilingual-adjust').click();await page.locator('#bilingual-follow').uncheck()
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('lector-language-tools')).follow)).toBe(false)
})

test('upgrading a version-five library keeps existing books and notes intact',async({page})=>{
  await page.addInitScript(()=>{
    const request=indexedDB.open('lector-zen',5)
    request.onupgradeneeded=()=>request.result.createObjectStore('books',{keyPath:'id'})
    request.onsuccess=()=>{const database=request.result,transaction=database.transaction('books','readwrite');transaction.objectStore('books').put({id:'legacy',title:'Libro anterior',filename:'legacy.txt',file:new Blob(['Texto guardado.'],{type:'text/plain'}),notes:[{id:'note',kind:'bookmark',label:'Anterior',text:'Mi nota conservada'}],updatedAt:1});transaction.oncomplete=()=>database.close()}
  })
  await page.goto('/');await expect(page.locator('.resume-button')).toHaveCount(1);await expect(page.locator('.resume-button')).toContainText('Libro anterior')
  const saved=await page.evaluate(async()=>{const {allBooks,getTranslation}=await import('/src/storage.js');return {books:await allBooks(),translation:await getTranslation('legacy')}})
  expect(saved.books[0].notes[0].text).toBe('Mi nota conservada');expect(saved.translation).toBeUndefined()
})

test('TV navigation stays inside the foreground dialog and Back dismisses only that dialog',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('lector-settings',JSON.stringify({tvMode:true})))
  await open(page);await selectWord(page);await page.locator('#define-selection').click();await page.locator('#peek-expand').click();await expect(page.locator('#dictionary-dialog')).toBeVisible()
  await page.locator('#dictionary-context').click();await expect(page.locator('#context-dialog')).toBeVisible()
  await page.locator('#context-configure').focus();await page.keyboard.press('ArrowUp')
  expect(await page.evaluate(()=>document.activeElement.closest('dialog')?.id)).toBe('context-dialog')
  await page.locator('#context-configure').focus();await page.keyboard.press('Backspace')
  await expect(page.locator('#context-dialog')).toBeHidden();await expect(page.locator('#dictionary-dialog')).toBeVisible()
})
