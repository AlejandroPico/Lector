import {toolbarAction} from './toolbar-fixture.js'
import {test,expect} from '@playwright/test'
import {coverEPUB} from './fixtures.js'
import sharp from 'sharp'
async function open(page){await page.goto('/');await page.locator('#file-input').setInputFiles({name:'jardin.epub',mimeType:'application/epub+zip',buffer:await coverEPUB()});await expect(page.locator('#audio-toggle')).toBeEnabled();await toolbarAction(page,'theme-toggle');await page.locator('[data-appearance="book"]').click();await page.keyboard.press('Escape')}

for(const reduced of [false,true])test(`returning to the front cover closes the book without visible sheets or live text ${reduced?'with reduced motion':'with animation'}`,async({page})=>{
 if(reduced)await page.emulateMedia({reducedMotion:'reduce'})
 await open(page);await page.locator('#start-reading').click();await expect(page.locator('.book-turn')).toHaveCount(0);await expect(page.locator('#reader')).toBeVisible()
 await page.locator('#book-edge-right').click();await expect(page.locator('.book-turn')).toHaveCount(0)
 for(let index=0;index<6&&await page.locator('#opening-cover').isHidden();index++){await page.locator('#book-edge-left').click();await expect(page.locator('.book-turn')).toHaveCount(0)}
 await expect(page.locator('#opening-cover')).toBeVisible();await expect(page.locator('#reader')).toBeHidden();await expect(page.locator('.book-folio')).toBeHidden();expect(await page.locator('#reader').evaluate(el=>el.inert)).toBe(true)
 await page.screenshot({path:`release/qa/200-closed-cover-${reduced}.png`});await page.locator('#start-reading').click();await expect(page.locator('.book-turn')).toHaveCount(0);await expect(page.locator('#reader')).toBeVisible();await expect(page.locator('.book-folio')).toBeVisible()
})

test('automatic night uses coherent light-on-dark menus and independently legible book paper',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-15T23:30:00+02:00'));await open(page);await page.locator('#start-reading').click();await expect(page.locator('.book-turn')).toHaveCount(0)
 await expect(page.locator('body')).toHaveAttribute('data-book-scene','night');await expect(page.locator('html')).toHaveCSS('color-scheme','dark')
 await page.locator('#index-toggle').click();await toolbarAction(page,'theme-toggle');await expect(page.locator('#sidebar')).toHaveCSS('background-color','rgb(35, 38, 44)');await expect(page.locator('#theme-panel')).toHaveCSS('background-color','rgb(35, 38, 44)')
 for(const selector of ['#book-title','#theme-title','[data-scene="night"]'])await expect(page.locator(selector)).toHaveCSS('color','rgb(245, 241, 233)')
 expect(await page.evaluate(()=>{const doc=document.querySelector('#reader').renderer.getContents()[0].doc;return doc.defaultView.getComputedStyle(doc.body).color})).toBe('rgb(53, 44, 35)')
 const bounds=await page.locator('#reader').boundingBox(),{data}=await sharp(await page.screenshot({clip:{x:Math.round(bounds.x+80),y:Math.round(bounds.y+30),width:1,height:1}})).raw().toBuffer({resolveWithObject:true})
 expect(data[0]-data[1]).toBeGreaterThan(10);expect(data[1]-data[2]).toBeGreaterThan(15)
 await page.screenshot({path:'release/qa/200-night-menus.png'})
 await page.locator('[data-scene="home"]').click();await expect(page.locator('html')).toHaveCSS('color-scheme','light');await page.locator('[data-scene="night"]').click();await expect(page.locator('html')).toHaveCSS('color-scheme','dark')
 await toolbarAction(page,'preferences-toggle');await page.getByText('General',{exact:true}).click();await expect(page.locator('[data-setting="uiLanguage"]')).toHaveCSS('color','rgb(245, 241, 233)')
})

test('twelve compact environment options include olive and a distinct office icon, with complete backgrounds',async({page})=>{
 await open(page);await toolbarAction(page,'theme-toggle');await expect(page.locator('[data-scene]')).toHaveCount(12)
 for(const [width,height] of [[1920,1080],[1366,768]]){await page.setViewportSize({width,height});expect(await page.locator('#theme-panel').evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1)}
 await page.locator('[data-scene="office"]').click();expect(await page.locator('#theme-toggle').innerHTML()).not.toBe(await page.locator('#appearance-toggle').innerHTML())
 await expect(page.locator('#book-environment')).toHaveCSS('background-size','100% 100%');await expect(page.locator('#book-environment')).toHaveCSS('background-repeat','no-repeat');await page.keyboard.press('Escape');await page.screenshot({path:'release/qa/200-office-complete.png'})
 await toolbarAction(page,'theme-toggle');await page.locator('[data-scene="olive"]').click();await expect(page.locator('body')).toHaveAttribute('data-book-scene','olive');await page.screenshot({path:'release/qa/200-olive-picker.png'});expect((await page.request.get('/scenes/olive.webp')).ok()).toBe(true)
 await page.reload();await page.locator('#dismiss-file').click();await expect(page.locator('body')).toHaveAttribute('data-book-scene','olive')
})
