import {test,expect} from '@playwright/test'
import {coverEPUB,epub} from './fixtures.js'
import sharp from 'sharp'
async function open(page,cover=false){await page.goto('/');await page.locator('#file-input').setInputFiles({name:'libro.epub',mimeType:'application/epub+zip',buffer:await (cover?coverEPUB():epub())});await expect(page.locator('#audio-toggle')).toBeEnabled()}

for(const [width,height] of [[1200,600],[600,1200],[800,800]])test(`image viewport fits ${width}x${height} without a toolbar, border or spare space`,async({page})=>{
 await open(page);const url=await page.evaluate(({width,height})=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const c=canvas.getContext('2d');c.fillStyle='#704020';c.fillRect(0,0,width,height);return canvas.toDataURL()}, {width,height})
 await page.evaluate(url=>{const doc=document.querySelector('#reader').renderer.getContents()[0].doc,image=doc.createElement('img');image.src=url;doc.body.append(image);image.click()},url)
 const dialog=page.locator('#image-dialog'),image=page.locator('#zoom-image');await expect(dialog).toBeVisible();await expect.poll(()=>image.evaluate(img=>img.naturalWidth)).toBe(width)
 const box=await dialog.boundingBox(),picture=await image.boundingBox();expect(Math.abs(box.width/box.height-width/height)).toBeLessThan(.002);expect(Math.abs(box.width-picture.width)).toBeLessThan(1);expect(Math.abs(box.height-picture.height)).toBeLessThan(1)
 await expect(dialog).toHaveCSS('border-top-width','0px');await expect(dialog).toHaveCSS('padding-top','0px');await expect(dialog.locator('.image-toolbar,output')).toHaveCount(0)
 const close=await dialog.locator('.dialog-close').boundingBox();expect(close.x+close.width).toBeLessThanOrEqual(box.x+box.width);expect(close.y).toBeGreaterThanOrEqual(box.y)
 await page.keyboard.press('+');await expect(page.locator('.image-stage')).toHaveAttribute('data-zoom','1.25');await page.keyboard.press('0');await expect(page.locator('.image-stage')).toHaveAttribute('data-zoom','1')
 await page.mouse.click(5,5);await expect(dialog).toBeHidden()
})

test('mobile pinch stays continuous when one finger lifts, resize fits again and Escape closes',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page,true);await page.locator('#opening-cover-zoom').click();const stage=page.locator('.image-stage');await expect(stage).toHaveAttribute('data-zoom','1')
 await stage.dispatchEvent('pointerdown',{pointerId:1,button:0,clientX:100,clientY:200});await stage.dispatchEvent('pointerdown',{pointerId:2,button:0,clientX:200,clientY:200});await stage.dispatchEvent('pointermove',{pointerId:2,button:0,clientX:300,clientY:200});await expect(stage).toHaveAttribute('data-zoom','2')
 await stage.dispatchEvent('pointerup',{pointerId:2,button:0});await stage.dispatchEvent('pointermove',{pointerId:1,button:0,clientX:130,clientY:210});await expect(stage).toHaveAttribute('data-zoom','2');await stage.dispatchEvent('pointercancel',{pointerId:1,button:0})
 await page.setViewportSize({width:844,height:390});await expect(stage).toHaveAttribute('data-zoom','1');const rect=await page.locator('#image-dialog').boundingBox();expect(rect.height).toBeLessThanOrEqual(358);expect(rect.width).toBeLessThanOrEqual(812)
 await page.keyboard.press('Escape');await expect(page.locator('#image-dialog')).toBeHidden();await expect(page.locator('#opening-cover-zoom')).toBeFocused()
})

for(const view of ['page','spread'])test(`mobile closed cover masks iframe paint and page sheets in ${view} view`,async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await open(page,true);await page.locator('#theme-toggle').click();await page.locator('[data-appearance="book"]').click();await page.keyboard.press('Escape')
 if(view==='spread'){await page.locator('#theme-toggle').click();await page.locator('[data-setting="bookMobileView"]').selectOption('spread');await page.keyboard.press('Escape')}
 await page.locator('#start-reading').click();await expect(page.locator('#reader')).toHaveCSS('opacity','1')
 await expect.poll(()=>page.evaluate(()=>Boolean(document.querySelector('#reader').renderer.getContents()[0]?.doc.body))).toBe(true)
 await page.evaluate(()=>{const doc=document.querySelector('#reader').renderer.getContents()[0].doc;doc.documentElement.style.setProperty('visibility','visible','important');doc.body.style.setProperty('background','#00ff00','important')})
 for(let i=0;i<8&&await page.locator('#opening-cover').isHidden();i++)await page.locator('#previous-page').click()
 await expect(page.locator('#opening-cover')).toBeVisible();await expect(page.locator('#reader')).toHaveCSS('opacity','0');await expect(page.locator('.book-folio')).toHaveCSS('opacity','0')
 const pixels=await sharp(await page.screenshot({path:`release/qa/220-mobile-cover-${view}.png`})).removeAlpha().raw().toBuffer();let green=0;for(let i=0;i<pixels.length;i+=3)if(pixels[i]<10&&pixels[i+1]>245&&pixels[i+2]<10)green++;expect(green).toBe(0)
 await page.setViewportSize({width:844,height:390});await expect(page.locator('#reader')).toHaveCSS('opacity','0');await page.locator('#start-reading').click();await expect(page.locator('#reader')).toHaveCSS('opacity','1');await expect(page.locator('.book-folio')).toHaveCSS('opacity','1')
})
