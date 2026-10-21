import {toolbarAction} from './toolbar-fixture.js'
import {test,expect} from '@playwright/test'
import sharp from 'sharp'
import {watchPrivateRequests} from './privacy-fixture.js'
test.setTimeout(90000)
const picture=async()=>({name:'Mi mesa.png',mimeType:'image/png',buffer:await sharp({create:{width:3200,height:1800,channels:3,background:'#416345'}}).png().toBuffer()})
async function open(page){
 await page.addInitScript(()=>{Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],addEventListener(){},cancel(){window.__cancels=(window.__cancels??0)+1},pause(){},resume(){},speak(u){window.__utterance=u;u.onstart?.()}}})})
 await page.goto('/');await page.locator('#file-input').setInputFiles({name:'libro.txt',mimeType:'text/plain',buffer:Buffer.from('Un libro para leer con tranquilidad. Otra frase después. '.repeat(50))});await expect(page.locator('#audio-toggle')).toBeEnabled()
 await toolbarAction(page,'theme-toggle');await page.locator('[data-appearance="book"]').click();await page.keyboard.press('Escape')
}
async function manager(page){await toolbarAction(page,'theme-toggle');await page.locator('#personal-scenes-open').click()}
async function add(page){await manager(page);await page.locator('#personal-scene-file').setInputFiles(await picture());await expect(page.locator('#personal-scene-save')).toBeEnabled();await page.locator('#personal-scene-name').fill('Mi rincón');await page.locator('#personal-scene-save').click();await expect(page.locator('#personal-scenes-dialog')).toBeHidden()}

test('photos are prepared locally, persist and can be renamed or removed while narration continues',async({page})=>{
 const external=watchPrivateRequests(page)
 await open(page);await page.locator('#audio-toggle').click();await expect.poll(()=>page.evaluate(()=>Boolean(window.__utterance))).toBe(true)
 const before=await page.evaluate(()=>({text:window.__utterance.text,cancels:window.__cancels}));await add(page)
 const id=await page.locator('body').getAttribute('data-book-scene');expect(id).toMatch(/^photo-/)
 await expect(page.locator('#book-environment')).toHaveCSS('background-size','100% 100%');expect(await page.locator('#book-environment').evaluate(el=>el.style.backgroundImage)).toContain('blob:')
 const saved=await page.evaluate(async()=>{const {allScenes}=await import('/src/storage.js');const [s]=await allScenes();return {count:(await allScenes()).length,width:s.width,height:s.height,type:s.image.type,name:s.name}})
 expect(saved).toEqual({count:1,width:2560,height:1440,type:'image/webp',name:'Mi rincón'})
 expect(await page.evaluate(()=>({text:window.__utterance.text,cancels:window.__cancels}))).toEqual(before)
 await manager(page);await page.locator('#personal-scene-name').fill('Una mesa propia');await page.locator('#personal-scene-contrast').selectOption('dark');await page.locator('#personal-scene-save').click()
 await expect(page.locator('#personal-scenes-dialog')).toBeHidden();await expect(page.locator('body')).toHaveAttribute('data-book-scene',id);await expect.poll(()=>page.locator('body').evaluate(el=>el.style.getPropertyValue('--desk-ink'))).toBe('#27231e')
 await page.screenshot({path:'test-results/26-personal-scene.png'});await page.reload();await page.locator('#dismiss-file').click();await expect(page.locator('body')).toHaveAttribute('data-book-scene',id)
 await manager(page);await expect(page.locator('#personal-scene-name')).toHaveValue('Una mesa propia');await page.locator('#personal-scene-delete').click()
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('lector-settings')).bookScene)).toBe('auto')
 expect(await page.evaluate(async()=>{const {allScenes,allBooks}=await import('/src/storage.js');return {photos:(await allScenes()).length,books:(await allBooks()).length}})).toEqual({photos:0,books:1});expect(external).toEqual([])
})

test('invalid image input cannot fetch external resources or replace the active scene',async({page})=>{
 await open(page);await add(page);const id=await page.locator('body').getAttribute('data-book-scene');await manager(page)
 await page.locator('#personal-scene-file').setInputFiles({name:'unsafe.png',mimeType:'image/png',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://tracker.invalid/x"/></svg>')})
 await expect(page.locator('#personal-scene-status')).toContainText('PNG, JPEG o WebP');await expect(page.locator('body')).toHaveAttribute('data-book-scene',id)
 await page.locator('#personal-scenes-close').click();await toolbarAction(page,'theme-toggle');await page.locator('[data-appearance="minimal"]').click();await expect(page.locator('#personal-scene-actions')).toBeHidden();await expect(page.locator('#book-environment')).toBeHidden()
})

test('personal scene manager is translated and fits a mobile display',async({browser})=>{
 const context=await browser.newContext({locale:'en-US',viewport:{width:390,height:844},baseURL:'http://127.0.0.1:5177'}),page=await context.newPage();await open(page);await manager(page)
 await expect(page.locator('#personal-scenes-title')).toHaveText('My scenes');await expect(page.getByLabel('Name',{exact:true})).toBeVisible();await page.locator('#personal-scene-file').setInputFiles(await picture());await expect(page.locator('#personal-scene-save')).toBeEnabled();await page.screenshot({path:'test-results/26-mobile-scenes.png'})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);expect(await page.locator('#personal-scenes-dialog').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);await context.close()
})
