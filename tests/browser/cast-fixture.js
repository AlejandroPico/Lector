import {expect} from '@playwright/test'
export const wave=Buffer.alloc(144044);wave.write('RIFF',0);wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(24000,24);wave.writeUInt32LE(48000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(wave.length-44,40)
// A valid WAV fixture; browser tests do not call speech synthesis or paid APIs.
export async function mockSpeech(page){await page.addInitScript(()=>{Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],addEventListener(){},cancel(){window.__cancels=(window.__cancels??0)+1},pause(){},resume(){},speak(u){window.__utterance=u;u.onstart?.()}}});const NativeAudio=window.Audio;window.Audio=function(...args){window.__localAudio=(window.__localAudio??0)+1;return new NativeAudio(...args)}})}
export async function mockCast(page,context,{cancel=false,missingReceiver=false}={}){
 const receiver=await context.newPage(),messages=[],errors=[]
 receiver.on('pageerror',error=>errors.push(error.message));page.on('pageerror',error=>errors.push(error.message))
 await receiver.exposeFunction('__toSender',message=>page.evaluate(data=>window.__senderMessage?.('',data),message))
 await receiver.addInitScript(()=>{
   const context={getPlayerManager:()=>({stop:()=>{document.getElementById('receiver-audio')?.pause()},load:async request=>{window.__loads=(window.__loads??0)+1;const audio=document.getElementById('receiver-audio');audio.src=request.media.contentId;await audio.play()}}),sendCustomMessage:(_ns,_sender,message)=>window.__toSender(message),addCustomMessageListener:(_ns,listener)=>window.__receiverMessage=listener,addEventListener:()=>{},start:options=>window.__receiverStarted=Boolean(options.mediaElement)}
   window.cast={framework:{CastReceiverContext:{getInstance:()=>context},messages:{LoadRequestData:class{},MediaInformation:class{},StreamType:{BUFFERED:'BUFFERED'}},system:{EventType:{SENDER_DISCONNECTED:'disconnected'},MessageType:{JSON:'JSON'}}}}
 })
 await receiver.goto('/receptor.html');await expect.poll(()=>receiver.evaluate(()=>window.__receiverStarted)).toBe(true);await receiver.locator('#receiver-brand').click()
 await page.route('**/config/cast.json*',route=>route.fulfill({contentType:'application/javascript',body:'export const receiverApplicationId="A1B2C3D4";export default {receiverApplicationId}'}))
 await page.exposeFunction('__toReceiver',async message=>{messages.push(message);if(!missingReceiver)await receiver.evaluate(data=>window.__receiverMessage({senderId:'sender-test',data}),message)})
 await page.addInitScript(({cancel})=>{
   const session={getCastDevice:()=>({friendlyName:'Altavoz de pruebas'}),addMessageListener:(_ns,listener)=>window.__senderMessage=listener,removeMessageListener:()=>window.__senderMessage=null,sendMessage:(_ns,data)=>window.__toReceiver(data)}
   const context={setOptions:options=>window.__castOptions=options,addEventListener:(_type,listener)=>window.__sessionListener=listener,getCurrentSession:()=>session,requestSession:async()=>{window.__requests=(window.__requests??0)+1;if(cancel)throw {code:'cancel'};window.__sessionListener({sessionState:'started'})},endCurrentSession:()=>window.__sessionListener?.({sessionState:'ended'})}
   window.chrome=window.chrome??{};window.chrome.cast={AutoJoinPolicy:{PAGE_SCOPED:'PAGE_SCOPED'}}
   window.cast={framework:{CastContext:{getInstance:()=>context},CastContextEventType:{SESSION_STATE_CHANGED:'state'},SessionState:{SESSION_STARTED:'started',SESSION_RESUMED:'resumed',SESSION_ENDED:'ended',SESSION_START_FAILED:'failed'}}}
 },{cancel})
 return {receiver,messages,errors}
}
export async function openCastBook(page){await page.goto('/');await expect(page.locator('#file-dialog')).toBeVisible();await page.locator('#file-input').setInputFiles({name:'Lectura.txt',mimeType:'text/plain',buffer:Buffer.from('La primera frase se escucha en el dispositivo elegido.\n\nLa segunda frase sigue sin cambiar la página.\n\nLa tercera frase termina el capítulo.')});await expect(page.locator('#audio-toggle')).toBeEnabled({timeout:30000});if(await page.locator('#start-reading').isVisible())await page.locator('#start-reading').click()}
export async function api(page){await page.locator('#voice-toggle').click();await page.locator('[data-setting="provider"]').selectOption('openai');await page.locator('[data-setting="endpoint"]').fill('https://voice.example/audio');await page.locator('[data-setting="endpoint"]').press('Tab');await page.locator('#api-key').fill('session-only');await page.keyboard.press('Escape');await page.route('https://voice.example/audio',route=>route.fulfill({contentType:'audio/wav',body:wave}))}
