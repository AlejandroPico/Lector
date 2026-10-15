import {test,expect} from '@playwright/test'

test('central settings and shortcuts share controls; credits are found without advanced menus',async({page})=>{
  await page.goto('/');await page.locator('#dismiss-file').click()
  await page.locator('#preferences-toggle').click()
  await expect(page.locator('#preferences-panel details[open]')).toHaveCount(0)
  await page.locator('#settings-search').fill('créditos')
  await expect(page.locator('#preferences-panel [data-setting="readingFlow"]')).toBeVisible()
  await page.locator('[data-setting="readingFlow"]').selectOption('scrolled')
  await page.locator('#appearance-toggle').click()
  await expect(page.locator('#appearance-panel [data-setting="readingFlow"]')).toHaveValue('scrolled')
  await expect(page.locator('[data-setting="readingFlow"]')).toHaveCount(1)
  await page.locator('[data-setting="readingFlow"]').selectOption('paginated')
  await page.locator('#preferences-toggle').click()
  await expect(page.locator('#preferences-panel [data-setting="readingFlow"]')).toHaveValue('paginated')
  await expect(page.locator('#settings-search')).toHaveValue('')
})

test('library tools float above compact catalogue on phone, leaving sidebar unchanged',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/')
  for(const title of ['Zulu','Alfa']) {
    await page.locator('#file-input').setInputFiles({name:`${title}.txt`,mimeType:'text/plain',buffer:Buffer.from(title+'\n\nTexto para leer.')})
    await expect(page.locator('#audio-toggle')).toBeEnabled()
  }
  await page.locator('#index-toggle').click();await page.getByRole('tab',{name:'Libros',exact:true}).click()
  await expect(page.locator('#library-tab #library-search')).toHaveCount(0)
  await expect(page.locator('.sidebar-book')).toHaveText(['Alfa','Zulu'])
  await page.locator('#library-expand').click()
  const toolbar=await page.locator('.library-toolbar').boundingBox()
  expect(toolbar.height).toBeLessThan(125)
  await page.locator('#library-filter-toggle').click()
  await expect(page.locator('#library-filter-dialog')).toBeVisible()
  await page.locator('#filter-status').selectOption('reading')
  await expect(page.locator('#library-filter-toggle')).toHaveAttribute('aria-pressed','true')
  await page.locator('#library-filter-dialog .dialog-close').click()
  await page.locator('#library-dialog-close').click()
  await expect(page.locator('.sidebar-book')).toHaveCount(2)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390)
})
