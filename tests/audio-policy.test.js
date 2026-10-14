import {test,expect,vi,afterEach} from 'vitest'
import {pronounce,spokenSegment,AudioBudget,audioEstimate,SleepTimer,waveHeader,pcmMono} from '../src/audio-policy.js'
import {safeSettings} from '../src/storage.js'
import {splitSentences} from '../src/speech.js'
afterEach(()=>{vi.useRealTimers();localStorage.clear()})
test('literal pronunciations preserve written positions across different spoken lengths',()=>{
 const text='El Sr. García abrió el libro.',converted=pronounce(text,[{from:'Sr.',to:'señor'}],true)
 expect(converted.text).toBe('El señor García abrió el libro.');expect(converted.source(converted.text.indexOf('García'))).toBe(text.indexOf('García'))
 const segment=spokenSegment({text,wordRange:(start,length)=>({start,length})},{pronunciationsEnabled:true,pronunciations:[{from:'Sr.',to:'señor'}]});expect(segment.wordRange(9,6)).toEqual({start:7,length:6})
 expect(pronounce('sol soleado Sol',[{from:'sol',to:'estrella'}],true).text).toBe('estrella soleado Sol');expect(pronounce(text,[],false).text).toBe(text)
 expect(splitSentences(text+' Otra frase.',1600,'es',['Sr.']).map(item=>item.text)).toEqual([text,'Otra frase.'])
})
test('the next request is blocked before spending or sending too many characters',()=>{
 let settings=safeSettings({voicePrice:1,costMargin:1,costLimitEnabled:true,costLimit:.01}),budget=new AudioBudget(()=>settings)
 budget.reserve('12345');expect(budget.usage().cost).toBe(.005);expect(()=>budget.reserve('123456')).toThrow('límite de gasto');expect(budget.usage().requests).toBe(1)
 settings=safeSettings({...settings,costLimitEnabled:false,characterLimitEnabled:true,characterLimit:7});expect(()=>budget.reserve('abc')).toThrow('límite de caracteres')
 settings={...settings,voiceCurrency:'USD'};expect(()=>budget.reserve('abc')).toThrow('límite de caracteres');budget.reset();expect(budget.usage().characters).toBe(0)
})
test('unknown tariffs are distinguished and cannot authorize an estimated spend limit',()=>{
 let settings=safeSettings(),budget=new AudioBudget(()=>settings);budget.reserve('Una frase.');expect(budget.usage().unpriced).toBe(1);settings.costLimitEnabled=true;expect(()=>budget.reserve('Otra.')).toThrow('tarifa positiva')
 expect(audioEstimate('Una frase.',safeSettings({voicePrice:2,costMargin:1})).cost).toBe(.02)
})
test('the sleep timer expires once, survives pause time and can be disabled',()=>{
 vi.useFakeTimers();const expired=vi.fn(),timer=new SleepTimer(expired);timer.arm(1);vi.advanceTimersByTime(30000);timer.arm(10);expect(timer.remaining()).toBe(30000);vi.advanceTimersByTime(30000);expect(expired).toHaveBeenCalledTimes(1);expect(timer.remaining()).toBe(0);timer.arm(1);timer.clear();vi.advanceTimersByTime(60000);expect(expired).toHaveBeenCalledTimes(1)
})
test('chapter audio has a complete WAV header and preserves order while resampling stereo',()=>{
 const pcm=pcmMono({length:2,sampleRate:24000,numberOfChannels:2,getChannelData:()=>new Float32Array([.5,-.5])}),header=new DataView(waveHeader(2));expect(header.getUint32(40,true)).toBe(pcm.byteLength);expect(header.getUint32(24,true)).toBe(24000);expect(new DataView(pcm).getInt16(0,true)).toBe(16384);expect(new DataView(pcm).getInt16(2,true)).toBe(-16384)
})
