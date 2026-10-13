import {test,expect} from '@playwright/test'
async function setup(page,count=3){
  await page.goto('/')
  await page.evaluate(async count=>{
    const root=await navigator.storage.getDirectory(),library=await root.getDirectoryHandle('Pruebas08',{create:true})
    const write=async(folder,name,value)=>{const file=await folder.getFileHandle(name,{create:true}),stream=await file.createWritable();await stream.write(value);await stream.close()}
    for(let index=0;index<count;index++){
      const folder=await library.getDirectoryHandle(`Libro ${index} (${index})`,{create:true})
      await write(folder,`Libro ${index}.epub`,'not-opened');await write(folder,'metadata.opf',`<package><metadata><title>Libro ${index}</title></metadata></package>`)
      await write(folder,'cover.svg','<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#568"/></svg>')
    }
    window.__library=library;window.__reads=[];const getFile=FileSystemFileHandle.prototype.getFile
    FileSystemFileHandle.prototype.getFile=async function(){window.__reads.push(this.name);if(window.__delay)await new Promise(resolve=>setTimeout(resolve,window.__delay));return getFile.call(this)}
    window.showDirectoryPicker=async()=>library
  },count)
  await page.locator('#choose-folder').click();await expect(page.locator('#folder-progress')).toBeHidden()
}
test('refresh reports deltas, retains unchanged covers and metadata and performs zero content reads',async({page})=>{
  await setup(page)
  await page.locator('.metadata-button').first().click();await page.locator('#library-view-covers').click();await page.locator('.catalog-cover').first().click()
  await expect(page.locator('.catalog-cover img')).toHaveCount(1)
  await page.evaluate(()=>window.__reads=[]);await page.locator('#refresh-folders').click();await expect(page.locator('#folder-progress')).toBeHidden()
  await expect(page.locator('#folder-summary')).toHaveText('Añadidos: 0 · Modificados: 0 · Retirados: 0 · Sin cambios: 3')
  await expect(page.locator('.catalog-cover img')).toHaveCount(1)
  await page.evaluate(async()=>{
    await window.__library.removeEntry('Libro 2 (2)',{recursive:true})
    const folder=await window.__library.getDirectoryHandle('Nuevo (4)',{create:true});await folder.getFileHandle('Nuevo.epub',{create:true})
    const original=await window.__library.getDirectoryHandle('Libro 1 (1)');await original.getFileHandle('Libro 1.mobi',{create:true})
  })
  await page.locator('#refresh-folders').click();await expect(page.locator('#folder-progress')).toBeHidden()
  await expect(page.locator('#folder-summary')).toHaveText('Añadidos: 1 · Modificados: 1 · Retirados: 1 · Sin cambios: 1')
  expect(await page.evaluate(()=>window.__reads)).toEqual([])
})
test('visible-cover queue is opt-in, cancellable and does not open ebooks or offscreen covers',async({page})=>{
  await setup(page,20);await page.locator('#library-view-covers').click();expect(await page.evaluate(()=>window.__reads)).toEqual([])
  await page.evaluate(()=>window.__delay=600)
  await page.locator('#preferences-toggle').click();await page.locator('#preferences-panel summary').filter({hasText:'Biblioteca'}).click()
  await page.locator('[data-setting="preloadCovers"]').check();await expect.poll(()=>page.evaluate(()=>window.__reads.length)).toBe(1)
  await page.locator('#pause-covers').click();await page.waitForTimeout(750)
  expect(await page.evaluate(()=>window.__reads)).toEqual(['cover.svg']);await expect(page.locator('.catalog-cover img')).toHaveCount(0)
  await page.evaluate(()=>window.__delay=0);await page.locator('#resume-covers').click();await expect.poll(()=>page.locator('.catalog-cover img').count()).toBeGreaterThan(0)
  await page.waitForTimeout(300)
  const reads=await page.evaluate(()=>window.__reads);expect(reads.every(name=>name==='cover.svg')).toBe(true);expect(reads.length).toBeLessThan(20)
  await page.keyboard.press('Escape');await page.locator('#library-search').fill('Libro 19');await expect(page.locator('.catalog-cover img')).toHaveCount(1)
})
