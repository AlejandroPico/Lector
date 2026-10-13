import { test, expect } from '@playwright/test'
import { epub, docx, mobi, pdf, longHTML } from './fixtures.js'

async function open(page, name = 'jardin.epub', buffer) {
  await page.goto('/')
  await expect(page.locator('#file-dialog')).toBeVisible()
  await page.locator('#file-input').setInputFiles({ name, mimeType: 'application/octet-stream', buffer: buffer ?? await epub() })
  await expect(page.locator('#loading')).toBeHidden()
  await expect(page.locator('#file-error')).toBeHidden()
  await expect(page.locator('#file-dialog')).toBeHidden()
  await expect(page.locator('#audio-toggle')).toBeEnabled()
  await expect.poll(() => page.evaluate(() => document.querySelector('#reader').renderer.getContents()[0]?.doc.body.textContent)).toBeTruthy()
}
const readerText = page => page.evaluate(() => document.querySelector('#reader').renderer.getContents()[0]?.doc?.body?.textContent ?? '')

test('startup stays minimal and prompts for a local document', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Abrir un libro', exact: true })).toBeVisible()
  await expect(page.locator('#sidebar')).toBeHidden()
  await expect(page.locator('.reading-footer')).toBeHidden()
  await page.screenshot({ path: 'test-results/inicio.png', fullPage: true })
})

test('EPUB paginates, has a nested index, stores position and resumes', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await open(page)
  await expect.poll(() => readerText(page)).toContain('El sosiego')
  const columns = await page.evaluate(() => document.querySelector('#reader').renderer.columnCount)
  expect(columns).toBe(2)
  await page.screenshot({ path: 'test-results/lectura.png', fullPage: true })
  const initial = await page.evaluate(() => document.querySelector('#reader').lastLocation.cfi)
  await page.locator('#next-page').click()
  await expect.poll(() => page.evaluate(() => document.querySelector('#reader').lastLocation.cfi)).not.toBe(initial)
  const current = await page.evaluate(() => document.querySelector('#reader').lastLocation.cfi)
  await expect.poll(() => page.evaluate(async () => {
    const { allBooks } = await import('/src/storage.js'); return (await allBooks())[0]?.cfi
  })).toBe(current)
  await page.reload()
  await expect(page.locator('.resume-button')).toHaveCount(1)
  await page.locator('.resume-button').click()
  await expect(page.locator('#file-dialog')).toBeHidden()
  await expect.poll(() => page.evaluate(() => document.querySelector('#reader').lastLocation.cfi)).toBe(current)
  await page.locator('#index-toggle').click()
  await expect(page.getByRole('button', { name: 'La ventana', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'El regreso', exact: true }).click()
  await expect.poll(() => readerText(page)).toContain('La mañana había llegado')
  expect(errors).toEqual([])
})

test('typography, three columns, themes and zen are real controls', async ({ page }) => {
  await open(page)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lector-settings')).theme)).toBe('auto')
  await page.locator('#appearance-toggle').click()
  await page.locator('[data-setting="columns"]').selectOption('3')
  await expect.poll(() => page.evaluate(() => document.querySelector('#reader').renderer.columnCount)).toBe(3)
  await page.locator('[data-setting="font"]').selectOption('Verdana')
  await page.locator('#fontSize').fill('24'); await page.locator('#fontSize').dispatchEvent('input')
  await expect.poll(() => page.evaluate(() => {
    const doc = document.querySelector('#reader').renderer.getContents()[0].doc
    return doc.defaultView.getComputedStyle(doc.body).fontSize
  })).toBe('24px')
  await page.locator('#theme-toggle').click(); await page.locator('button[data-theme="night"]').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night')
  await page.keyboard.press('Escape'); await page.locator('#zen-toggle').click()
  await expect(page.locator('.toolbar')).toBeHidden()
  await page.screenshot({ path: 'test-results/noche-zen.png', fullPage: true })
  await page.keyboard.press('Escape'); await expect(page.locator('.toolbar')).toBeVisible()
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'night')
})

async function selectWord(page, word) {
  await page.evaluate(word => {
    const doc = document.querySelector('#reader').renderer.getContents()[0].doc
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) if (node.textContent.includes(word)) break
    const range = doc.createRange(), start = node.textContent.indexOf(word)
    range.setStart(node, start); range.setEnd(node, start + word.length)
    const selection = doc.defaultView.getSelection(); selection.removeAllRanges(); selection.addRange(range)
    doc.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  }, word)
  await expect(page.locator('#selection-menu')).toBeVisible()
}

test('selection opens the dictionary and saves anchored notes and bookmarks', async ({ page }) => {
  await open(page)
  await selectWord(page, 'sosiego')
  await page.locator('#define-selection').click()
  await expect(page.locator('#dictionary-definition')).toContainText('tranquilidad')
  await page.locator('#dictionary-dialog .dialog-close').click()
  await selectWord(page, 'sosiego')
  await page.locator('#annotate-selection').click()
  await page.locator('#note-text').fill('Recordar esta palabra.')
  await page.locator('#save-note').click()
  await expect(page.locator('#note-dialog')).toBeHidden()
  await page.locator('#index-toggle').click(); await page.getByRole('tab', { name: 'Notas', exact: true }).click()
  await expect(page.locator('#notes-list')).toContainText('Recordar esta palabra.')
  await page.locator('#add-bookmark').click(); await expect(page.locator('.note-row')).toHaveCount(2)
  await expect.poll(() => page.evaluate(async () => { const { allBooks } = await import('/src/storage.js'); return (await allBooks())[0]?.notes.length })).toBe(2)
  await page.reload(); await page.locator('.resume-button').click()
  await page.locator('#index-toggle').click(); await page.getByRole('tab', { name: 'Notas', exact: true }).click()
  await expect(page.locator('.note-row')).toHaveCount(2)
})

test('images zoom, footnotes float and untrusted book content cannot execute or track', async ({ page }) => {
  const trackers = []; page.on('request', request => { if (request.url().includes('example.com')) trackers.push(request.url()) })
  await open(page)
  await page.locator('#index-toggle').click(); await page.getByRole('button', { name: 'El regreso', exact: true }).click()
  await page.locator('#sidebar-close').click()
  await expect.poll(() => readerText(page)).toContain('La mañana')
  await page.evaluate(() => document.querySelector('#reader').renderer.getContents()[0].doc.querySelector('img').click())
  await expect(page.locator('#image-dialog')).toBeVisible()
  await expect.poll(() => page.locator('#zoom-image').evaluate(image => image.naturalWidth)).toBeGreaterThan(0)
  await page.locator('#zoom-in').click(); await expect(page.locator('#zoom-level')).toHaveText('125 %')
  await page.locator('#image-dialog .dialog-close').click()
  await page.evaluate(() => document.querySelector('#reader').renderer.getContents()[0].doc.querySelector('a').click())
  await expect(page.locator('#footnote-dialog')).toBeVisible()
  await expect(page.locator('#footnote-content')).toContainText('Una nota a pie de página')
  expect(await page.evaluate(() => window.__bookExecuted)).toBeUndefined()
  expect(trackers).toEqual([])
})

test('search finds text and navigates to its location', async ({ page }) => {
  await open(page); await page.locator('#index-toggle').click()
  await page.locator('#search-query').fill('La mañana'); await page.locator('#search-form button').click()
  await expect(page.locator('.search-result')).toHaveCount(1)
  await page.locator('.search-result').click()
  await expect.poll(() => readerText(page)).toContain('La mañana había llegado')
})

for (const [name, buffer, text] of [
  ['prueba.mobi', mobi, 'Libro MOBI de prueba'],
  ['prueba.docx', docx, 'Este texto procede de un archivo Word'],
  ['prueba.pdf', pdf, 'Documento PDF de prueba'],
  ['prueba.txt', () => Buffer.from('El sosiego regresó.\n\nUna nueva página.'), 'El sosiego regresó'],
]) test(`imports ${name}`, async ({ page }) => {
  await open(page, name, await buffer())
  await expect.poll(() => readerText(page)).toContain(text)
  if (name.endsWith('.pdf')) {
    await page.evaluate(() => document.querySelector('#reader').renderer.getContents()[0].doc.querySelector('[data-pdf-page]').click())
    await expect(page.locator('#image-dialog')).toBeVisible()
    await expect.poll(() => page.locator('#zoom-image').evaluate(image => image.naturalWidth)).toBeGreaterThan(0)
  }
})

test('scanned PDF is viewable and explains that narration needs OCR', async ({ page }) => {
  await open(page, 'escaneado.pdf', pdf(true))
  await expect(page.locator('#toast')).toContainText('OCR')
  await expect.poll(() => readerText(page)).toContain('no tiene texto seleccionable')
})

test('invalid files show a recoverable error', async ({ page }) => {
  await page.goto('/')
  await page.locator('#file-input').setInputFiles({ name: 'broken.epub', mimeType: 'application/epub+zip', buffer: Buffer.from('broken') })
  await expect(page.locator('#loading')).toBeHidden()
  await expect(page.locator('#file-error')).toContainText('No se pudo abrir')
  await page.locator('#file-input').setInputFiles({ name: 'old.doc', mimeType: 'application/msword', buffer: Buffer.from('old') })
  await expect(page.locator('#file-error')).toContainText('.docx')
})

test('API narration is opt-in, sends only chosen text and never persists the key', async ({ page }) => {
  const requests = []
  await page.route('https://api.openai.com/v1/audio/speech', async route => {
    requests.push(route.request().postDataJSON())
    await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"test"}' })
  })
  await open(page)
  expect(requests).toEqual([])
  await page.locator('#voice-toggle').click()
  await page.locator('[data-setting="provider"]').selectOption('openai')
  await expect(page.locator('#api-voice-settings')).toContainText('coste por uso')
  await page.locator('#api-key').fill('sk-test-only-not-real')
  await page.locator('#voice-preview').click()
  await expect.poll(() => requests.length).toBe(1)
  expect(requests[0].input).toBe('La tarde caía despacio. Por un momento, todo quedó en silencio.')
  await expect(page.locator('#toast')).toContainText('clave de API no es válida')
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('sk-test-only')
  await page.reload(); await page.locator('#dismiss-file').click(); await page.locator('#voice-toggle').click()
  await expect(page.locator('#api-key')).toHaveValue('')
})

test('small screens use one readable column and retain accessible controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  await expect.poll(() => page.evaluate(() => document.querySelector('#reader').renderer.columnCount)).toBe(1)
  await page.screenshot({ path: 'test-results/movil.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await page.locator('#appearance-toggle').click()
  await expect(page.locator('#appearance-panel')).toBeVisible()
})

test('browser narration starts at the visible sentence, highlights and pauses', async ({ page }) => {
  await page.addInitScript(() => {
    window.__spoken = []
    let current
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => [], addEventListener() {},
      speak(utterance) { current = utterance; window.__spoken.push(utterance.text); utterance.onboundary?.({ name: 'word', charIndex: 0, charLength: 2 }) },
      cancel() { current?.onerror?.({ error: 'canceled' }); current = null },
      pause() { window.__speechPaused = true }, resume() { window.__speechPaused = false },
    } })
  })
  await open(page)
  await page.locator('#index-toggle').click(); await page.getByRole('button', { name: 'La ventana', exact: true }).click()
  await page.locator('#sidebar-close').click()
  const visibleParagraph = await page.evaluate(() => document.querySelector('#reader').lastLocation.range.startContainer.parentElement.closest('p')?.id)
  await page.locator('#audio-toggle').click()
  await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBe(1)
  expect((await page.evaluate(() => window.__spoken))[0]).not.toContain('El jardín en silencio')
  await expect.poll(() => page.evaluate(() => {
    const win = document.querySelector('#reader').renderer.getContents()[0].doc.defaultView
    return win.CSS.highlights.has('spoken')
  })).toBe(true)
  expect(await page.evaluate(() => {
    const doc = document.querySelector('#reader').renderer.getContents()[0].doc
    const range = [...doc.defaultView.CSS.highlights.get('spoken')][0]
    return range.startContainer.parentElement.closest('p')?.id
  })).toBe(visibleParagraph)
  await page.locator('#audio-toggle').click(); expect(await page.evaluate(() => window.__speechPaused)).toBe(true)
  await page.locator('#audio-toggle').click(); expect(await page.evaluate(() => window.__speechPaused)).toBe(false)
  await page.locator('#voice-toggle').click(); await page.locator('#audio-stop').click()
  await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-label', 'Leer en voz alta')
})
