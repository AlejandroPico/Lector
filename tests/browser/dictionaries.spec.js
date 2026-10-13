import {test,expect} from '@playwright/test'
import {epub} from './fixtures.js'
async function manager(page){await page.goto('/');await page.locator('#dismiss-file').click();await page.locator('#preferences-toggle').click();await page.locator('#preferences-panel summary').filter({hasText:'Notas y vocabulario'}).click();await page.locator('#settings-dictionaries').click();await expect(page.locator('#dictionary-manager')).toBeVisible()}
async function wordSearch(page,word,language='es'){
  await page.locator('#dictionary-manager .dialog-close').click();await page.locator('#preferences-toggle').click();await page.locator('#settings-word').click()
  await page.locator('#dictionary-language').selectOption(language);await page.locator('#dictionary-query').fill(word);await page.locator('#dictionary-search-form button').click()
}
test('Spanish package installation persists and all lookups remain offline after reload',async({page,context})=>{
  const requests=[];page.on('request',request=>{if(request.url().includes('.json.gz')&&request.resourceType()==='fetch')requests.push(request.url())})
  await manager(page);await expect(page.locator('.dictionary-pack-row')).toHaveCount(10);expect(requests).toEqual([])
  await page.locator('#dictionary-pack-language').selectOption('es');await page.getByRole('button',{name:'Instalar',exact:true}).click()
  await expect(page.locator('#dictionary-install-progress')).toBeHidden({timeout:60000});await expect(page.getByRole('button',{name:'Eliminar paquete',exact:true})).toBeVisible();expect(requests).toHaveLength(64)
  await wordSearch(page,'sosiego');await expect(page.locator('#dictionary-source')).toContainText('Wiktionary');await expect(page.locator('#dictionary-definition')).toContainText('tranquilidad')
  await page.reload();await page.locator('#dismiss-file').click();await page.locator('#preferences-toggle').click();await page.locator('#preferences-panel summary').filter({hasText:'Notas y vocabulario'}).click();await page.locator('#settings-word').click()
  await context.setOffline(true);await page.locator('#dictionary-query').fill('umbral');await page.locator('#dictionary-search-form button').click();await expect(page.locator('#dictionary-source')).toContainText('Wiktionary');await expect(page.locator('#dictionary-definition')).not.toContainText('No se encontró')
  expect(requests).toHaveLength(64);await context.setOffline(false)
})
test('canceling a package removes partial installation and its stored chunks',async({page})=>{
  await manager(page);await page.locator('#dictionary-pack-language').selectOption('es')
  await page.route('**/*.json.gz',async route=>{await new Promise(resolve=>setTimeout(resolve,400));await route.continue().catch(()=>{})})
  await page.getByRole('button',{name:'Instalar',exact:true}).click();await expect(page.locator('#dictionary-install-progress')).toBeVisible();await page.locator('#dictionary-install-cancel').click();await expect(page.locator('#dictionary-install-progress')).toBeHidden()
  const state=await page.evaluate(async()=>{const {allDictionaryPacks}=await import('/src/storage.js');return await allDictionaryPacks()});expect(state).toEqual([])
  const chunks=await page.evaluate(()=>new Promise(resolve=>{const open=indexedDB.open('lector-zen');open.onsuccess=()=>{const db=open.result,request=db.transaction('dictionaryChunks').objectStore('dictionaryChunks').count();request.onsuccess=()=>{resolve(request.result);db.close()}}}));expect(chunks).toBe(0)
})
test('personal Hindi dictionary and learned vocabulary survive reload and package removal',async({page})=>{
  await manager(page)
  const data={name:'Diccionario propio',language:'hi',definitionLanguage:'hi',license:'Personal',entries:{किताब:'पढ़ने के लिए लिखित पृष्ठों का संग्रह।'}}
  await page.locator('#dictionary-manager-file').setInputFiles({name:'hindi.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))})
  await expect(page.locator('#dictionary-install-progress')).toBeHidden();await expect(page.locator('.dictionary-pack-row').filter({hasText:'Diccionario propio'})).toBeVisible()
  await wordSearch(page,'किताब','hi');await expect(page.locator('#dictionary-definition')).toContainText('पढ़ने');await page.locator('#dictionary-save-word').click()
  await page.locator('#dictionary-dialog .dialog-close').click();await page.locator('#preferences-toggle').click();await page.locator('#settings-vocabulary').click();await page.locator('.vocabulary-row summary').click()
  await page.locator('.vocabulary-row textarea').fill('Palabra aprendida');await page.locator('.vocabulary-row input[type="checkbox"]').check();await page.getByRole('button',{name:'Guardar',exact:true}).click()
  // The summary is refreshed only after the storage transaction completes.
  await expect(page.locator('.vocabulary-row summary')).toContainText('Aprendida')
  await page.reload();await page.locator('#dismiss-file').click();await page.locator('#preferences-toggle').click();await page.locator('#preferences-panel summary').filter({hasText:'Notas y vocabulario'}).click();await page.locator('#settings-vocabulary').click()
  await page.locator('#vocabulary-state').selectOption('learned');await expect(page.locator('.vocabulary-row')).toHaveCount(1);await page.locator('.vocabulary-row summary').click();await expect(page.locator('.vocabulary-row textarea')).toHaveValue('Palabra aprendida')
  await page.locator('#vocabulary-dialog .dialog-close').click();await page.locator('#preferences-toggle').click();await page.locator('#settings-dictionaries').click();await page.locator('.dictionary-pack-row').filter({hasText:'Diccionario propio'}).getByRole('button',{name:'Eliminar paquete',exact:true}).click()
  expect(await page.evaluate(async()=>{const {allVocabulary}=await import('/src/storage.js');return (await allVocabulary()).length})).toBe(1)
})
test('corrupt data is rejected and legacy glossary stays usable without installation',async({page})=>{
  await page.goto('/');await page.locator('#file-input').setInputFiles({name:'test.epub',mimeType:'application/epub+zip',buffer:await epub()});await expect(page.locator('#audio-toggle')).toBeEnabled()
  await page.locator('#preferences-toggle').click();await page.locator('#preferences-panel summary').filter({hasText:'Notas y vocabulario'}).click();await page.locator('#settings-word').click();await page.locator('#dictionary-query').fill('sosiego');await page.locator('#dictionary-search-form button').click()
  await expect(page.locator('#dictionary-definition')).toContainText('tranquilidad');await expect(page.locator('#dictionary-source')).toHaveText('Glosario básico')
  await page.locator('#dictionary-manage').click();await page.locator('#dictionary-pack-language').selectOption('es');await page.route('**/*.json.gz',route=>route.fulfill({body:'bad gzip'}));await page.getByRole('button',{name:'Instalar',exact:true}).click();await expect(page.locator('#dictionary-install-progress')).toBeHidden()
  expect(await page.evaluate(async()=>{const {allDictionaryPacks}=await import('/src/storage.js');return await allDictionaryPacks()})).toEqual([])
})
test('mobile dictionary manager fits and shows translated controls and package definition languages',async({browser})=>{
  const context=await browser.newContext({locale:'fr-FR',viewport:{width:390,height:844},baseURL:'http://127.0.0.1:5177'}),page=await context.newPage()
  await page.goto('/');await page.locator('#dismiss-file').click();await page.locator('#preferences-toggle').click();await page.locator('#preferences-panel summary').filter({hasText:'Notes et vocabulaire'}).click();await page.locator('#settings-dictionaries').click()
  await expect(page.locator('#dictionary-manager-title')).toHaveText('Dictionnaires hors ligne');await page.locator('#dictionary-pack-language').selectOption('ca')
  await expect(page.locator('.dictionary-pack-row')).toContainText('Définitions: English');await expect(page.getByRole('button',{name:'Installer',exact:true})).toBeVisible()
  expect(await page.locator('#dictionary-manager').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false)
  await page.screenshot({path:'test-results/10-mobile-dictionaries.png'});await context.close()
})
test('vocabulary retains the selected location when narration advances to another chapter',async({page})=>{
  await page.goto('/');await page.locator('#file-input').setInputFiles({name:'test.epub',mimeType:'application/epub+zip',buffer:await epub()});await expect(page.locator('#audio-toggle')).toBeEnabled()
  await page.evaluate(()=>{
    const doc=document.querySelector('#reader').renderer.getContents()[0].doc,walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);let node
    while(node=walker.nextNode())if(node.textContent.includes('sosiego'))break
    const range=doc.createRange(),offset=node.textContent.indexOf('sosiego');range.setStart(node,offset);range.setEnd(node,offset+7)
    const selected=doc.defaultView.getSelection();selected.removeAllRanges();selected.addRange(range);doc.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))
  });await page.locator('#define-selection').click();await expect(page.locator('#dictionary-save-word')).toBeEnabled()
  await page.evaluate(()=>document.querySelector('#reader').goTo(1));await page.locator('#dictionary-save-word').click()
  await expect.poll(()=>page.evaluate(async()=>{const {allVocabulary}=await import('/src/storage.js');return (await allVocabulary()).length})).toBe(1)
  const entry=await page.evaluate(async()=>{const {allVocabulary}=await import('/src/storage.js');return (await allVocabulary())[0]})
  expect(entry.reference).toMatch(/^Ubicación 1\./);expect(entry.cfi).toContain('epubcfi')
})
