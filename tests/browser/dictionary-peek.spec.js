import {test,expect} from '@playwright/test'
import JSZip from 'jszip'
import {epub} from './fixtures.js'
async function open(page){
 const zip=await JSZip.loadAsync(await epub());zip.file('OPS/chapter1.xhtml',(await zip.file('OPS/chapter1.xhtml').async('string')).replace('El sosiego de la tarde','El especial libro de la tarde'))
 await page.goto('/');await page.locator('#file-input').setInputFiles({name:'palabras.epub',mimeType:'application/epub+zip',buffer:await zip.generateAsync({type:'nodebuffer'})});await expect(page.locator('#audio-toggle')).toBeEnabled()
 await expect.poll(()=>page.evaluate(()=>Boolean(document.querySelector('#reader').renderer.getContents()[0]?.doc.body))).toBe(true)
}
async function select(page,word='especial'){
 await page.evaluate(word=>{const doc=document.querySelector('#reader').renderer.getContents()[0].doc,walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode())if(node.textContent.includes(word))break;const range=doc.createRange(),offset=node.textContent.indexOf(word);range.setStart(node,offset);range.setEnd(node,offset+word.length);const selection=doc.defaultView.getSelection();selection.removeAllRanges();selection.addRange(range);doc.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))},word)
 await page.locator('#define-selection').click();await expect(page.locator('#dictionary-peek')).toBeVisible()
}

test('especial works without installation in an anchored brief definition, expands and saves its origin',async({page})=>{
 const requests=[];page.on('request',r=>{if(r.url().includes('.json.gz'))requests.push(r.url())});await open(page);expect(requests).toEqual([]);const cfi=await page.evaluate(()=>document.querySelector('#reader').lastLocation.cfi)
 await select(page);await expect(page.locator('#peek-definition')).toContainText('Singular o particular');await expect(page.locator('#peek-grammar')).toContainText('Adjetivo');await expect(page.locator('#peek-grammar')).toContainText('Adverbio');await expect(page.locator('#dictionary-dialog')).toBeHidden();await expect(page.locator('#peek-source')).toContainText('CC-BY-SA-4.0')
 expect(requests).toHaveLength(2);expect(requests.every(url=>url.startsWith('http://127.0.0.1:5177/')&&!url.includes('especial'))).toBe(true)
 const box=await page.locator('#dictionary-peek').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(1440);expect(box.y+box.height).toBeLessThanOrEqual(960);expect(await page.evaluate(()=>document.querySelector('#reader').lastLocation.cfi)).toBe(cfi)
 await page.screenshot({path:'test-results/230-definition.png'});await page.locator('#peek-expand').click();await expect(page.locator('#dictionary-dialog')).toBeVisible();await expect(page.locator('#dictionary-word')).toHaveText('especial');await expect(page.locator('#dictionary-grammar')).toContainText('Adjetivo');await expect(page.locator('#dictionary-definition')).toContainText('Especialmente');await page.locator('#dictionary-save-word').click()
 const state=await page.evaluate(async()=>{const s=await import('/src/storage.js');return {packs:await s.allDictionaryPacks(),words:await s.allVocabulary()}});expect(state.packs).toEqual([]);expect(state.words[0].word).toBe('especial');expect(state.words[0].cfi).toContain('epubcfi');expect(requests).toHaveLength(2)
})

test('mobile dark definition remains within the viewport, uses the book language and closes with Escape',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.addInitScript(()=>localStorage.setItem('lector-settings',JSON.stringify({uiLanguage:'en',theme:'contrast'})));await open(page);await select(page);await expect(page.locator('#peek-grammar')).toContainText('Adjective');await expect(page.locator('#peek-definition')).toContainText('Singular o particular');await expect(page.locator('#peek-expand')).toHaveAttribute('aria-label','Expand definition')
 const box=await page.locator('#dictionary-peek').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390);expect(box.y+box.height).toBeLessThanOrEqual(844);await page.screenshot({path:'test-results/230-definition-mobile.png'});await page.keyboard.press('Escape');await expect(page.locator('#dictionary-peek')).toBeHidden();await expect(page.locator('#dictionary-dialog')).toBeHidden()
})

test('dismissing on book text does not restart the current utterance or navigate',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],addEventListener(){},cancel(){window.__cancels=(window.__cancels??0)+1},pause(){},resume(){},speak(u){window.__utterance=u;u.onstart?.()}}}));await open(page);await page.locator('#audio-toggle').click();await expect.poll(()=>page.evaluate(()=>window.__utterance?.text)).toBeTruthy();const before=await page.evaluate(()=>({text:window.__utterance.text,cancels:window.__cancels,cfi:document.querySelector('#reader').lastLocation.cfi}))
 await select(page);await expect(page.locator('#peek-definition')).toContainText('Singular');await page.evaluate(()=>{const doc=document.querySelector('#reader').renderer.getContents()[0].doc,p=doc.querySelector('p');p.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:100,clientY:100}));p.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:100,clientY:100}))});await expect(page.locator('#dictionary-peek')).toBeHidden();expect(await page.evaluate(()=>({text:window.__utterance.text,cancels:window.__cancels,cfi:document.querySelector('#reader').lastLocation.cfi}))).toEqual(before)
})

test('ten project dictionaries answer explicit regional-language queries without installing packages',async({page})=>{
 test.setTimeout(90000);await page.goto('/');await page.locator('#dismiss-file').click()
 for(const [language,word] of [['es-ES','especial'],['ca','llibre'],['en','book'],['fr','livre'],['de','Haus'],['pt','livro'],['it','libro'],['zh','安静'],['ja','本'],['hi','किताब']]){
  const result=await page.evaluate(async({language,word})=>{const {lookupOffline}=await import('/src/offline-dictionaries.js');return lookupOffline(word,language,{project:true})},{language,word});expect(result?.definition.length,language).toBeGreaterThan(3);expect(result?.partsOfSpeech.length,language).toBeGreaterThan(0);expect(result.pack.language).toBe(language.split('-')[0])
 }
 expect(await page.evaluate(async()=>(await (await import('/src/storage.js')).allDictionaryPacks()).length)).toBe(0)
})

test('a delayed old answer cannot overwrite a newer word or reopen a dismissed bubble',async({page})=>{
 let release,delayed=false;const gate=new Promise(resolve=>release=resolve)
 await page.route('**/*.json.gz',async route=>{if(!delayed){delayed=true;await gate}await route.continue().catch(()=>{})});await open(page);await select(page);await expect(page.locator('#peek-definition')).toHaveText('Buscando…');await page.locator('#peek-close').click();await select(page,'libro');await expect(page.locator('#peek-definition')).not.toHaveText('Buscando…');release();await expect(page.locator('#peek-word')).toHaveText('libro');await page.locator('#peek-close').click();await expect(page.locator('#dictionary-peek')).toBeHidden()
})

test('a missing word differs from an unavailable resource and corrupt blocks are never displayed',async({page})=>{
 await open(page);await page.route('**/*.json.gz',route=>route.fulfill({body:'corrupt'}));await select(page);await expect(page.locator('#peek-definition')).toContainText('No se pudo acceder');await page.locator('#peek-expand').click();await expect(page.locator('#dictionary-save-word')).toBeDisabled();await page.unroute('**/*.json.gz');await page.locator('#dictionary-query').fill('zzzzsinpalabrazzzz');await page.locator('#dictionary-search-form button').click();await expect(page.locator('#dictionary-definition')).toContainText('No se encontró esta palabra')
})

test('TV directional focus stays in the brief definition and Back closes it',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('lector-settings',JSON.stringify({tvMode:true})));await open(page);await select(page);await expect(page.locator('#peek-close')).toBeFocused();await page.keyboard.press('ArrowLeft');expect(await page.evaluate(()=>document.activeElement.closest('[role="dialog"]')?.id)).toBe('dictionary-peek');await page.keyboard.press('Backspace');await expect(page.locator('#dictionary-peek')).toBeHidden();await expect(page.locator('#dictionary-dialog')).toBeHidden()
})

test('an older installed dictionary keeps priority and works offline without fabricated grammar',async({page,context})=>{
 await open(page);await page.evaluate(async()=>{const s=await import('/src/storage.js'),{dictionaryBucket}=await import('/src/dictionary-core.js'),bucket=dictionaryBucket('especial');await s.saveDictionaryPack({id:'previous-es',name:'Mi paquete anterior',language:'es',definitionLanguage:'es',entries:1,buckets:64,installed:true,installedAt:1,license:'Personal'});await s.saveDictionaryChunk({id:`previous-es:${bucket}`,packId:'previous-es',bucket,encoding:'json',blob:new Blob([JSON.stringify([['especial','Definición anterior conservada.']])])})});await context.setOffline(true);await select(page);await expect(page.locator('#peek-definition')).toHaveText('Definición anterior conservada.');await expect(page.locator('#peek-grammar')).toHaveText('Categoría no indicada');await expect(page.locator('#peek-source')).toContainText('Mi paquete anterior');expect(await page.evaluate(async()=>(await (await import('/src/storage.js')).allDictionaryPacks())[0].id)).toBe('previous-es');await context.setOffline(false)
})
