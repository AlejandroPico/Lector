import {toolbarAction} from './toolbar-fixture.js'
import {test,expect} from '@playwright/test'
import {epub} from './fixtures.js'
async function open(page){await page.goto('/');await page.locator('#file-input').setInputFiles({name:'libro.epub',mimeType:'application/epub+zip',buffer:await epub()});await expect(page.locator('#audio-toggle')).toBeEnabled()}

test('full-height sidebar slides for half a second and favicon or X closes it',async({page})=>{
 await open(page);await page.locator('#index-toggle').click();const panel=page.locator('#sidebar')
 expect(await panel.evaluate(el=>el.getAnimations()[0]?.effect.getTiming().duration)).toBe(500)
 await expect(page.locator('#sidebar-brand-close')).toBeFocused();const box=await panel.boundingBox();expect(box.y).toBe(0);expect(box.height).toBe(960)
 await expect(page.locator('#sidebar-brand-close')).toHaveText('Lector');expect(await page.locator('#sidebar-brand-close img').getAttribute('src')).toContain('favicon.svg')
 await page.locator('#sidebar-brand-close').click();expect(await panel.evaluate(el=>el.getAnimations()[0]?.effect.getTiming().duration)).toBe(500);await expect(panel).toBeHidden();await expect(page.locator('#index-toggle')).toBeFocused()
 await page.locator('#index-toggle').click();await page.locator('#sidebar-close').click();await expect(panel).toBeHidden()
})

test('sidebar and Settings scroll without showing scrollbars',async({page})=>{
 await open(page);await page.locator('#index-toggle').click();await expect(page.locator('#sidebar-brand-close')).toBeFocused()
 await page.locator('#contents-tab').evaluate(el=>{const space=document.createElement('div');space.style.height='2000px';el.append(space)})
 await expect(page.locator('#sidebar')).toHaveCSS('scrollbar-width','none');await page.mouse.move(140,400);await page.mouse.wheel(0,500);await expect.poll(()=>page.locator('#sidebar').evaluate(el=>el.scrollTop)).toBeGreaterThan(100)
 await page.locator('#sidebar-close').click();await expect(page.locator('#sidebar')).toBeHidden();await toolbarAction(page,'preferences-toggle')
 const settings=page.locator('#preferences-panel');await settings.evaluate(el=>el.querySelectorAll('details').forEach(d=>d.open=true));await expect(settings).toHaveCSS('scrollbar-width','none');await settings.hover();await page.mouse.wheel(0,500);await expect.poll(()=>settings.evaluate(el=>el.scrollTop)).toBeGreaterThan(100)
})

test('mobile sidebar reaches the top, reduced motion and rapid reversal remain usable',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await open(page);await page.locator('#index-toggle').click();await expect(page.locator('#sidebar-brand-close')).toBeFocused();const box=await page.locator('#sidebar').boundingBox();expect(box.y).toBe(0);expect(box.height).toBe(844);expect(box.width).toBeLessThan(390)
 await page.evaluate(()=>{document.querySelector('#sidebar-close').click();document.querySelector('#index-toggle').click()});await expect(page.locator('#sidebar')).toBeVisible();await expect(page.locator('#index-toggle')).toHaveAttribute('aria-expanded','true');await page.locator('#sidebar-close').click();await expect(page.locator('#sidebar')).toBeHidden()
})
