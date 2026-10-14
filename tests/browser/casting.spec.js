import {test,expect} from '@playwright/test'
import {spawn,execFileSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {resolve} from 'node:path'
let relay
const wave=Buffer.alloc(960044);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(24000,24);wave.writeUInt32LE(48000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(wave.length-44,40)
const origin='http://127.0.0.1:5177',endpoint='http://127.0.0.1:5058',headers={Origin:origin,'Content-Type':'application/json'}
test.beforeAll(async()=>{
 const web=existsSync('dist/receptor.html')?resolve('dist'):resolve('test-results/receiver-fixture')
 if(web!==resolve('dist'))execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build','--outDir',web],{stdio:'pipe'})
 const bundled='C:/Users/darim/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
 relay=spawn(process.platform==='win32'&&existsSync(bundled)?bundled:'python3',['emision-local/servidor.py','--red','--direccion','127.0.0.1','--puerto','5058','--web',web],{stdio:'pipe'})
 await new Promise((res,rej)=>{relay.stdout.once('data',res);relay.once('error',rej);relay.once('exit',code=>rej(new Error(`relay ${code}`)))})
})
test.afterAll(()=>relay?.kill())
async function open(page){await page.goto('/');await page.locator('#dismiss-file').click();await page.locator('#preferences-toggle').click();await page.locator('#preferences-panel > details').filter({has:page.locator('#settings-casting')}).locator('summary').first().click();await page.locator('#settings-casting').click();await page.locator('#casting-dialog details summary').click();await page.locator('#cast-bridge').fill(endpoint)}
test('LAN receiver plays real WAV, accepts pause/seek, and stops after revocation',async({page,browser})=>{
 await open(page);await expect(page.locator('#cast-text')).not.toBeChecked();await page.locator('#cast-file').setInputFiles({name:'Mi audio.wav',mimeType:'audio/wav',buffer:wave});await page.locator('#cast-start').click();await expect(page.locator('#cast-status')).toHaveText('Abre el receptor en el otro dispositivo.')
 const link=await page.locator('#cast-link').getAttribute('href'),context=await browser.newContext(),receiver=await context.newPage();await receiver.goto(link);await expect(receiver.locator('#title')).toHaveText('Mi audio.wav');await expect(receiver.locator('#audio')).toHaveAttribute('src',/\/media\//);await expect.poll(()=>receiver.evaluate(()=>document.querySelector('audio').readyState)).toBeGreaterThan(0)
 await receiver.evaluate(()=>document.querySelector('audio').play());await expect(receiver.locator('#status')).toHaveText('Reproduciendo');await page.locator('#cast-pause').click();await expect.poll(()=>receiver.evaluate(()=>document.querySelector('audio').paused)).toBe(true)
 await page.locator('#cast-seconds').fill('2');await page.locator('#cast-seek').click();await expect.poll(()=>receiver.evaluate(()=>document.querySelector('audio').currentTime)).toBeCloseTo(2)
 const stored=await page.evaluate(()=>JSON.stringify(localStorage));expect(stored).not.toContain(link.split('#')[1]);await page.locator('#casting-dialog .dialog-close').click();await expect(receiver.locator('#title')).toHaveText('Mi audio.wav')
 await page.locator('#preferences-toggle').click();await page.locator('#settings-casting').click();await page.locator('#cast-stop').click();await expect(receiver.locator('#status')).toHaveText('La emisión ha terminado o ha caducado.');await context.close()
})
test('relay isolates administration, validates audio and serves correct byte ranges',async()=>{
 const denied=await fetch(endpoint+'/session',{method:'POST',headers:{...headers,Origin:'https://other.example'},body:'{}'});expect(denied.status).toBe(403)
 const response=await fetch(endpoint+'/session',{method:'POST',headers,body:JSON.stringify({presentation:{title:'Range',colors:['red','bad','css']}})});const session=await response.json()
 const bad=await fetch(endpoint+'/media/'+session.token,{method:'POST',headers:{Origin:origin,'Content-Type':'audio/wav'},body:'not audio'});expect(bad.status).toBe(415)
 expect((await fetch(endpoint+'/media/'+session.token,{method:'POST',headers:{Origin:origin,'Content-Type':'audio/wav'},body:wave})).status).toBe(200)
 const range=await fetch(endpoint+'/media/'+session.token,{headers:{Range:'bytes=8-11'}});expect(range.status).toBe(206);expect(Buffer.from(await range.arrayBuffer()).toString()).toBe('WAVE');expect(range.headers.get('content-range')).toBe(`bytes 8-11/${wave.length}`)
 expect((await fetch(endpoint+'/media/'+session.token,{headers:{Range:'bytes=999999-'}})).status).toBe(416)
 expect((await fetch(endpoint+'/package.json')).status).toBe(404);expect((await fetch(endpoint+'/src/main.js')).status).toBe(404)
 await fetch(endpoint+'/session/'+session.token,{method:'DELETE',headers:{Origin:origin}});expect((await fetch(endpoint+'/media/'+session.token)).status).toBe(404)
})
test('opening emission does not load Google SDK, start paid generation or interrupt local voice',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],addEventListener(){},cancel(){},pause(){window.__pauses=(window.__pauses??0)+1},resume(){},speak(utterance){window.__utterance=utterance;utterance.onstart?.()}}}));let sdk=0;page.on('request',request=>{if(request.url().includes('gstatic.com/cv/'))sdk++})
 await page.goto('/');await page.locator('#file-input').setInputFiles({name:'voz.txt',mimeType:'text/plain',buffer:Buffer.from('Esta lectura continúa mientras reviso los ajustes.')});await page.locator('#audio-toggle').click();await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-label','Pausar lectura');await page.locator('#preferences-toggle').click();await page.locator('#preferences-panel > details').filter({has:page.locator('#settings-casting')}).locator('summary').first().click();await page.locator('#settings-casting').click();await page.locator('#cast-target').selectOption('custom');await expect(page.locator('#cast-app-field')).toBeVisible();await page.locator('#casting-dialog .dialog-close').click();expect(sdk).toBe(0);await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-label','Pausar lectura');expect(await page.evaluate(()=>window.__pauses??0)).toBe(0)
})
test('English emission settings fit on mobile without sending text by default',async({browser})=>{
 const context=await browser.newContext({locale:'en-US',viewport:{width:390,height:844},baseURL:origin}),page=await context.newPage();await open(page);await expect(page.locator('#casting-title')).toHaveText('Cast reading');await expect(page.locator('#cast-text')).not.toBeChecked();expect(await page.locator('#casting-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await context.close()
})
