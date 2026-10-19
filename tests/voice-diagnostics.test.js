import {it,expect,vi,afterEach} from 'vitest'
import {probeVoice,VoiceDiagnostics} from '../src/voice-diagnostics.js'
import {SpeechController} from '../src/speech.js'
const a={voiceURI:'a',name:'A',lang:'es-ES'},b={voiceURI:'b',name:'B',lang:'es-ES'}
class Utterance{constructor(text){this.text=text}}
afterEach(()=>vi.useRealTimers())
it('uses the exact voice and region, reports failures and continues without retries',async()=>{
  const spoken=[],locks=[],synthesis={getVoices:()=>[a,b],speak(u){spoken.push(u);queueMicrotask(()=>u.voice===a?u.onerror({error:'synthesis-failed'}):u.onend())},cancel:vi.fn()}
  const runner=new VoiceDiagnostics({synthesis,Utterance,onLock:value=>locks.push(value)})
  const results=await runner.start([a,b],'Muestra')
  expect(results.map(r=>r.status)).toEqual(['failed','completed']);expect(results[0].error).toBe('synthesis-failed')
  expect(spoken.map(u=>u.voice)).toEqual([a,b]);expect(spoken.map(u=>u.lang)).toEqual(['es-ES','es-ES'])
  expect(synthesis.cancel).not.toHaveBeenCalled();expect(locks).toEqual([true,false]);expect(runner.running).toBe(false)
})
it('never takes over an active or paused narration and validates limits before synthesis',async()=>{
  const synthesis={speaking:false,getVoices:()=>[a],speak:vi.fn(),cancel:vi.fn()},runner=new VoiceDiagnostics({synthesis,Utterance,isBusy:()=>true})
  await expect(runner.start([a],'Hola')).rejects.toThrow('Detén la lectura')
  expect(synthesis.cancel).not.toHaveBeenCalled();expect(synthesis.speak).not.toHaveBeenCalled()
  const idle=new VoiceDiagnostics({synthesis,Utterance})
  await expect(idle.start(Array(26).fill(a),'Hola')).rejects.toThrow('25')
  await expect(idle.start([a],'x'.repeat(201))).rejects.toThrow('200')
  expect(synthesis.speak).not.toHaveBeenCalled()
})
it('cancels a hung sample, releases the lease and never starts the remaining voices',async()=>{
  let utterance
  const synthesis={getVoices:()=>[a,b],speak:vi.fn(u=>utterance=u),cancel:vi.fn()},runner=new VoiceDiagnostics({synthesis,Utterance})
  const pending=runner.start([a,b],'Muestra');expect(runner.running).toBe(true)
  await expect(runner.start([b],'Otra')).rejects.toThrow()
  runner.cancel();const results=await pending
  expect(results.map(r=>r.status)).toEqual(['cancelled']);expect(synthesis.speak).toHaveBeenCalledTimes(1)
  expect(synthesis.cancel).toHaveBeenCalledTimes(1);expect(utterance.onend).toBeNull();expect(runner.running).toBe(false)
})
it('bounds samples that receive no callbacks and rejects voices which disappeared without fallback',async()=>{
  vi.useFakeTimers();const synthesis={getVoices:()=>[b],speak:vi.fn(),cancel:vi.fn()}
  expect(await probeVoice(a,{synthesis,Utterance,text:'Hola'})).toEqual({status:'unavailable'})
  const pending=probeVoice(b,{synthesis,Utterance,text:'Hola',timeout:15})
  await vi.advanceTimersByTimeAsync(15);expect(await pending).toEqual({status:'timeout'});expect(synthesis.cancel).toHaveBeenCalledTimes(1)
})
it('the reading controller refuses new playback while a diagnostic owns synthesis',async()=>{
  const onError=vi.fn()
  await SpeechController.prototype.toggle.call({diagnostics:{running:true},onError})
  expect(onError).toHaveBeenCalledWith('Cancela la prueba de voces antes de iniciar la lectura.')
})
