import { test, expect } from '@playwright/test'
import { epub } from './fixtures.js'

async function open(page, text) {
  await page.goto('/')
  await page.locator('#file-input').setInputFiles(text ? {name:'voz.txt',mimeType:'text/plain',buffer:Buffer.from(text)}
    : {name:'libro.epub',mimeType:'application/epub+zip',buffer:await epub()})
  await expect(page.locator('#audio-toggle')).toBeEnabled()
  await expect(page.locator('#file-dialog')).toBeHidden()
}
async function mockSpeech(page) {
  await page.addInitScript(()=>{
    window.__spoken=[]
    Object.defineProperty(window,'speechSynthesis',{value:{
      getVoices:()=>[],addEventListener(){},cancel(){},pause(){},resume(){},
      speak(utterance){ window.__utterance=utterance; window.__spoken.push(utterance.text) },
    }})
  })
}
test('reading controls are centered and Play is circular on desktop',async ({page})=>{
  await open(page)
  const box=await page.locator('.toolbar-reading').boundingBox()
  expect(Math.abs(box.x+box.width/2-720)).toBeLessThan(2)
  await expect(page.locator('#audio-toggle')).toHaveCSS('border-radius','50%')
  await page.screenshot({path:'test-results/03-controls.png'})
})
test('a voice without word events advances at a page boundary inside a sentence',async ({page})=>{
  await mockSpeech(page)
  await page.setViewportSize({width:900,height:400})
  await open(page,Array.from({length:180},(_,i)=>`palabra${i}`).join(' ')+'.')
  await page.locator('#audio-toggle').click()
  await expect.poll(()=>page.evaluate(()=>window.__spoken.length)).toBe(1)
  const before=await page.evaluate(()=>document.querySelector('#reader').lastLocation.cfi)
  await page.evaluate(()=>window.__utterance.onend())
  await expect.poll(()=>page.evaluate(()=>window.__spoken.length)).toBe(2)
  await expect.poll(()=>page.evaluate(()=>document.querySelector('#reader').lastLocation.cfi)).not.toBe(before)
  const text=await page.evaluate(()=>window.__spoken.join(' '))
  expect(text).toMatch(/^palabra0 palabra1/)
  expect(text).not.toContain('palabra179')
})
test('clicking a word restarts there and tracking controls persist independently',async ({page})=>{
  await mockSpeech(page); await open(page)
  await page.locator('#audio-toggle').click()
  await expect.poll(()=>page.evaluate(()=>window.__spoken.length)).toBe(1)
  const point=await page.evaluate(()=>{
    const doc=document.querySelector('#reader').renderer.getContents()[0].doc
    const node=doc.querySelector('p').firstChild, offset=node.textContent.indexOf('umbral')
    const range=doc.createRange();range.setStart(node,offset);range.setEnd(node,offset+6)
    const rect=range.getBoundingClientRect(),frame=doc.defaultView.frameElement.getBoundingClientRect()
    return {x:frame.x+rect.x+rect.width/2,y:frame.y+rect.y+rect.height/2}
  })
  await page.mouse.click(point.x,point.y)
  await expect.poll(()=>page.evaluate(()=>window.__spoken.at(-1))).toMatch(/^umbral/)
  await page.locator('#voice-toggle').click()
  await page.locator('[data-setting="highlight"]').uncheck()
  await page.locator('[data-setting="followSpeech"]').uncheck()
  await page.locator('[data-setting="clickToRead"]').uncheck()
  await page.reload();await page.locator('#dismiss-file').click();await page.locator('#voice-toggle').click()
  for(const key of ['highlight','followSpeech','clickToRead']) await expect(page.locator(`[data-setting="${key}"]`)).not.toBeChecked()
})
