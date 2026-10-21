import {test,expect} from '@playwright/test'
import {mockSpeech} from './cast-fixture.js'
import {toolbarAction} from './toolbar-fixture.js'
const ids=['appearance','theme','zen','fullscreen','preferences','about'].map(name=>`${name}-toggle`)
async function open(page){
  await mockSpeech(page);await page.goto('/')
  await page.locator('#file-input').setInputFiles({name:'movil.txt',mimeType:'text/plain',buffer:Buffer.from('Una lectura tranquila que debe continuar mientras abrimos los menús. '.repeat(50))})
  await expect(page.locator('#audio-toggle')).toBeEnabled()
}
async function fits(locator,width,height){const box=await locator.boundingBox();expect(box).not.toBeNull();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);expect(box.y+box.height).toBeLessThanOrEqual(height+1)}

test('portrait and landscape expose every tool without clipping the reading controls',async({page})=>{
  await page.setViewportSize({width:320,height:640});await open(page)
  for(const [width,height] of [[320,640],[844,390],[390,844]]){
    await page.setViewportSize({width,height})
    for(const id of ['index-toggle','open-file','audio-toggle','voice-toggle','tools-toggle'])await fits(page.locator(`#${id}`),width,height)
    await page.locator('#tools-toggle').click();await expect(page.locator('#tools-drawer')).toBeVisible()
    await expect(page.locator('#tools-drawer')).toHaveCSS('scrollbar-width','none')
    for(const id of ids){const action=page.locator(`#${id}`);await action.scrollIntoViewIfNeeded();await expect(action).toBeVisible();await fits(action,width,height)}
    await page.screenshot({path:`test-results/214-toolbar-${width}.png`})
    await page.keyboard.press('Escape');await expect(page.locator('#tools-drawer')).toBeHidden();await expect(page.locator('#tools-toggle')).toBeFocused()
  }
})

test('tools remain the same controls across rotation and preserve narration and focus',async({page})=>{
  await page.setViewportSize({width:390,height:844});await open(page);await page.locator('#audio-toggle').click()
  const before=await page.evaluate(()=>({text:window.__utterance.text,cancels:window.__cancels}))
  await toolbarAction(page,'appearance-toggle');await expect(page.locator('#appearance-panel')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#tools-toggle')).toBeFocused()
  await toolbarAction(page,'theme-toggle');await expect(page.locator('#theme-panel')).toBeVisible();await page.keyboard.press('Escape')
  await toolbarAction(page,'preferences-toggle');await expect(page.locator('#preferences-panel')).toBeVisible();await page.keyboard.press('Escape')
  await page.setViewportSize({width:1440,height:960});await expect(page.locator('#tools-toggle')).toBeHidden()
  for(const id of ids){await expect(page.locator(`.toolbar #${id}`)).toBeVisible();await expect(page.locator(`#${id}`)).toHaveCount(1)}
  await page.setViewportSize({width:844,height:390});await toolbarAction(page,'about-toggle');await expect(page.locator('#about-dialog')).toBeVisible();await page.keyboard.press('Escape')
  expect(await page.evaluate(()=>({text:window.__utterance.text,cancels:window.__cancels}))).toEqual(before)
})

test('mobile tools support keyboard dismissal, reduced motion, translation and zen exit',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await open(page)
  await toolbarAction(page,'preferences-toggle');await page.locator('#settings-search').fill('idioma');await page.locator('[data-setting="uiLanguage"]').selectOption('en');await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Tools',exact:true}).click();await expect(page.locator('#tools-title')).toHaveText('Tools')
  await page.locator('#about-toggle').focus();await page.keyboard.press('Tab');await expect(page.locator('#tools-close')).toBeFocused()
  await page.keyboard.press('Shift+Tab');await expect(page.locator('#about-toggle')).toBeFocused()
  await page.keyboard.press('Escape');await expect(page.locator('#tools-toggle')).toBeFocused()
  await toolbarAction(page,'zen-toggle');await expect(page.locator('body')).toHaveClass(/zen/);await page.locator('#zen-exit').click();await expect(page.locator('#tools-toggle')).toBeVisible()
})
