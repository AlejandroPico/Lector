import {test,expect} from '@playwright/test'
import {coverEPUB} from './fixtures.js'

async function folderCatalog(page){
  await page.goto('/')
  await page.evaluate(async()=>{
    const root=await navigator.storage.getDirectory(),library=await root.getDirectoryHandle('Catálogo',{create:true}),author=await library.getDirectoryHandle('Autor',{create:true})
    const rows=[['Dos',2,'es','Historia'],['Diez',10,'en','Ciencia'],['Uno',1,'ca','Historia'],['Dos',2,'es','Historia']]
    const write=async(folder,name,value)=>{const file=await folder.getFileHandle(name,{create:true}),stream=await file.createWritable();await stream.write(value);await stream.close()}
    for(let index=0;index<rows.length;index++){
      const [title,position,language,genre]=rows[index],folder=await author.getDirectoryHandle(`Libro ${index} (${index})`,{create:true})
      await write(folder,`Libro ${index}.mobi`,'fixture-not-opened')
      if(index!==1)await write(folder,`Libro ${index}.epub`,'fixture-not-opened')
      await write(folder,'metadata.opf',`<package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>${title}</dc:title><dc:creator>Autora</dc:creator><dc:language>${language}</dc:language><dc:subject>Ciencia, tecnología</dc:subject><meta name="calibre:series" content="Saga"/><meta name="calibre:series_index" content="${position}"/><meta name="calibre:user_metadata:#genre" content='{&quot;#value#&quot;:&quot;${genre}&quot;}'/></metadata></package>`)
      await write(folder,'cover.svg','<svg xmlns="http://www.w3.org/2000/svg" width="20" height="30"/>')
    }
    window.__catalogRoot=library;window.__fileReads=[]
    const getFile=FileSystemFileHandle.prototype.getFile
    FileSystemFileHandle.prototype.getFile=async function(){window.__fileReads.push(this.name);if(window.__metadataDelay&&this.name==='metadata.opf')await new Promise(resolve=>setTimeout(resolve,window.__metadataDelay));return getFile.call(this)}
    window.showDirectoryPicker=async()=>library
  })
  await page.locator('#choose-folder').click();await expect(page.locator('#folder-progress')).toBeHidden();await expect(page.locator('.library-book')).toHaveCount(4)
  await page.locator('#library-filters summary').click()
}
async function loadedCatalog(page){
  await folderCatalog(page)
  expect(await page.evaluate(()=>window.__fileReads)).toEqual([])
  await page.locator('#read-visible-metadata').click();await expect(page.locator('#metadata-progress')).toBeHidden()
  await expect(page.locator('#filter-series option[value="Saga"]')).toHaveCount(1)
  expect(await page.evaluate(()=>window.__fileReads)).toEqual(Array(4).fill('metadata.opf'))
}
test('Calibre filters and numeric series order read only explicitly requested OPF metadata',async({page})=>{
  await loadedCatalog(page)
  await page.locator('#library-sort').selectOption('series')
  await expect(page.locator('.library-book')).toHaveText(['Uno','Dos','Dos','Diez'])
  await page.locator('#filter-language').selectOption('en');await expect(page.locator('.library-book')).toHaveText(['Diez'])
  await page.locator('#filter-format').selectOption('epub');await expect(page.locator('.library-book')).toHaveCount(0)
  await page.locator('#clear-library-filters').click();await page.locator('#filter-genre').selectOption('Historia');await expect(page.locator('.library-book')).toHaveCount(3)
  await page.locator('#filter-tag').selectOption('Ciencia, tecnología');await page.locator('#filter-author').selectOption('Autora');await expect(page.locator('.library-book')).toHaveCount(3)
  expect(await page.evaluate(()=>window.__fileReads)).toEqual(Array(4).fill('metadata.opf'))
})
test('states, metadata overrides and virtual collections survive refresh, changed formats and reload',async({page})=>{
  await loadedCatalog(page)
  const row=page.locator('.library-row').filter({has:page.locator('.library-book',{hasText:'Diez'})})
  await row.locator('.organize-book').click();await page.locator('#organize-status').selectOption('finished')
  await page.locator('#organize-form summary').click();await page.locator('#organize-genres').fill('Ensayo');await page.locator('#organize-tags').fill('Lectura personal\nCiencia, tecnología')
  await page.locator('#organize-collection-name').fill('Favoritos');await page.locator('#organize-collection-create').click()
  await expect(page.locator('#organize-collections input')).toBeChecked()
  await page.getByRole('button',{name:'Guardar organización',exact:true}).click();await expect(page.locator('#organize-dialog')).toBeHidden()
  await page.locator('#filter-status').selectOption('finished');await page.locator('#filter-genre').selectOption('Ensayo')
  await page.locator('#filter-collection').selectOption({label:'Favoritos'});await expect(page.locator('.library-book')).toHaveText(['Diez'])
  await page.evaluate(async()=>{
    const author=await window.__catalogRoot.getDirectoryHandle('Autor'),folder=await author.getDirectoryHandle('Libro 1 (1)'),file=await folder.getFileHandle('Nueva edición.epub',{create:true}),stream=await file.createWritable();await stream.write('not-opened');await stream.close()
  })
  await page.locator('#refresh-folders').click();await expect(page.locator('#folder-progress')).toBeHidden();await expect(page.locator('.library-book')).toHaveText(['Diez'])
  await page.locator('#filter-format').selectOption('epub');await expect(page.locator('.library-book')).toHaveText(['Diez'])
  expect(await page.evaluate(()=>window.__fileReads)).toEqual(Array(4).fill('metadata.opf'))
  await page.reload();await page.locator('#dismiss-file').click();await page.locator('#index-toggle').click();await page.getByRole('tab',{name:'Libros',exact:true}).click()
  await expect(page.locator('.library-book')).toHaveCount(4);await page.locator('#library-filters summary').click()
  await page.locator('#filter-status').selectOption('finished');await page.locator('#filter-collection').selectOption({label:'Favoritos'});await expect(page.locator('.library-book')).toHaveText(['Diez'])
  await page.locator('#collection-delete').click();await expect(page.locator('#filter-collection option')).toHaveCount(1)
  await page.locator('#clear-library-filters').click();await expect(page.locator('.library-book')).toHaveCount(4)
})
test('duplicate review retains all books and can restrict the library to one candidate group',async({page})=>{
  await loadedCatalog(page);await page.locator('#show-duplicates').click()
  await expect(page.locator('#duplicates-dialog')).toBeVisible();await expect(page.locator('.duplicate-group')).toHaveCount(1)
  await page.getByRole('button',{name:'Ver grupo en biblioteca',exact:true}).click();await expect(page.locator('#library-dialog')).toBeVisible()
  await expect(page.locator('.library-book')).toHaveText(['Dos','Dos'])
  await page.locator('#clear-library-filters').click();await expect(page.locator('.library-book')).toHaveCount(4)
  expect(await page.evaluate(()=>window.__fileReads)).toEqual(Array(4).fill('metadata.opf'))
})
test('metadata batch cancellation stops before reading the remaining books',async({page})=>{
  await folderCatalog(page);await page.evaluate(()=>window.__metadataDelay=600)
  await page.locator('#read-visible-metadata').click();await expect(page.locator('#metadata-progress')).toBeVisible()
  await page.locator('#metadata-cancel').click();await expect(page.locator('#metadata-progress')).toBeHidden()
  expect(await page.evaluate(()=>window.__fileReads)).toEqual(['metadata.opf'])
  await expect(page.locator('#filter-series option[value="Saga"]')).toHaveCount(0)
})
test('mobile catalog organization and translated controls preserve user titles',async({browser})=>{
  const context=await browser.newContext({locale:'en-US',viewport:{width:390,height:844},baseURL:'http://127.0.0.1:5177'}),page=await context.newPage()
  await page.goto('/');await page.locator('#file-input').setInputFiles({name:'a.epub',mimeType:'application/epub+zip',buffer:await coverEPUB('Título propio')})
  await expect(page.locator('#opening-cover')).toBeVisible();await page.locator('#start-reading').click()
  await page.locator('#index-toggle').click();await page.getByRole('tab',{name:'Books',exact:true}).click();await page.locator('#library-expand').click()
  await page.getByRole('button',{name:'Organize book: Título propio',exact:true}).click();await expect(page.locator('#organize-title')).toHaveText('Título propio')
  await expect(page.locator('#organize-status')).toHaveValue('reading');await page.locator('#organize-status').selectOption('finished')
  await page.getByRole('button',{name:'Save organization',exact:true}).click();await page.getByText('Filters and collections',{exact:true}).click()
  await page.locator('#filter-status').selectOption('finished');await expect(page.locator('.library-book')).toHaveText(['Título propio'])
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390)
  const overflow=await page.locator('#library-dialog').evaluate(el=>el.scrollWidth>el.clientWidth);expect(overflow).toBe(false)
  await page.screenshot({path:'test-results/07-mobile-catalog.png'});await context.close()
})

test('a saved five-thousand-book catalog renders in batches and filters without reading files',async({page})=>{
  await page.goto('/')
  await page.evaluate(async()=>{
    const {saveFolder}=await import('/src/storage.js'),root=await navigator.storage.getDirectory()
    window.__fileReads=[];const getFile=FileSystemFileHandle.prototype.getFile
    FileSystemFileHandle.prototype.getFile=function(){window.__fileReads.push(this.name);return getFile.call(this)}
    await saveFolder({id:'large',name:'Biblioteca grande',handle:root,entries:Array.from({length:5000},(_,index)=>({key:`book-${index}`,title:`Libro ${index}`,author:`Autor ${index}`,language:index%2?'en':'es',formats:[{extension:index%2?'epub':'mobi',name:`Libro ${index}`}]}))})
  })
  await page.locator('#dismiss-file').click();await page.locator('#index-toggle').click();await page.getByRole('tab',{name:'Libros',exact:true}).click()
  await expect(page.locator('#library-count')).toContainText('5000 libros');await expect(page.locator('.library-book')).toHaveCount(60)
  await page.locator('#library-more').click();await expect(page.locator('.library-book')).toHaveCount(120)
  await page.locator('#library-filters summary').click();await page.locator('#filter-author').selectOption('Autor 4999');await expect(page.locator('.library-book')).toHaveText(['Libro 4999'])
  await page.locator('#filter-format').selectOption('mobi');await expect(page.locator('.library-book')).toHaveCount(0)
  await page.locator('#clear-library-filters').click();await page.locator('#filter-language').selectOption('es');await expect(page.locator('#library-count')).toContainText('2500 libros')
  expect(await page.evaluate(()=>window.__fileReads)).toEqual([])
})
