import {describe,it,expect} from 'vitest'
import {safeCast,narrationSettings,castSegments,dialogueSuggestions,parsedSpeakerSuggestions} from '../src/narration.js'
import {documentSpeech} from '../src/speech.js'
import {readableParagraphs} from '../src/context-core.js'
import {defaults} from '../src/storage.js'
const doc=html=>new DOMParser().parseFromString(html,'text/html')
function viewFor(ranges){return {resolveNavigation:cfi=>ranges[cfi],getCFI:(index,range)=>`epubcfi(${index}:${range.toString()})`}}
describe('persistent narration roles',()=>{
 it('routes an exact partial sentence to a character without dropping or repeating the surrounding text',()=>{
  const source=doc('<p>Al entrar dijo hola al jardín.</p>'),node=source.querySelector('p').firstChild,range=source.createRange();range.setStart(node,15);range.setEnd(node,19)
  const cfi='epubcfi(test)',view=viewFor({[cfi]:{index:0,anchor:()=>range}}),cast={characters:[{id:'actor-ana',name:'Ana',apiVoice:'nova'}],assignments:[{id:'1',cfi,characterId:'actor-ana'}]}
  const segment=documentSpeech(source)[0],parts=castSegments(segment,0,cast,view,true)
  expect(parts.map(part=>part.text).join('')).toBe(segment.text)
  expect(parts.find(part=>part.characterId==='actor-ana').text).toBe('hola')
  expect(parts.map(part=>part.characterId)).toEqual(['narrator','actor-ana','narrator'])
  expect(parts[1].wordRange(0,4).toString()).toBe('hola')
 })
 it('later corrections win on an overlap, while an invalid or other-chapter anchor never applies',()=>{
  const source=doc('<p>uno dos tres</p>'),node=source.querySelector('p').firstChild,a=source.createRange(),b=source.createRange();a.setStart(node,0);a.setEnd(node,7);b.setStart(node,4);b.setEnd(node,7)
  const view=viewFor({'epubcfi(a)':{index:0,anchor:()=>a},'epubcfi(b)':{index:0,anchor:()=>b},'epubcfi(other)':{index:1,anchor:()=>a}}),cast={characters:[{id:'actor-a',name:'A'},{id:'actor-b',name:'B'}],assignments:[{cfi:'epubcfi(a)',characterId:'actor-a'},{cfi:'epubcfi(b)',characterId:'actor-b'},{cfi:'epubcfi(other)',characterId:'actor-a'}]}
  const parts=castSegments(documentSpeech(source)[0],0,cast,view,true);expect(parts.find(part=>part.text==='dos').characterId).toBe('actor-b');expect(parts.map(part=>part.text).join('')).toBe('uno dos tres')
 })
 it('disabling characters keeps narration profiles but ignores character voices',()=>{
  const settings={...defaults,apiVoice:'coral',narrationProfile:'calm'},cast={characters:[{id:'actor-ana',name:'Ana',apiVoice:'nova',rate:1.1,pitch:1.1}]}
  expect(narrationSettings(settings,cast,'actor-ana').apiVoice).toBe('coral')
  const selected=narrationSettings({...settings,narrationEnabled:true},cast,'actor-ana');expect(selected.apiVoice).toBe('nova');expect(selected.rate).toBeCloseTo(.99);expect(selected.instructions).toContain('Read calmly')
 })
 it('local dialogue proposals leave uncertain names empty and need acceptance',()=>{
  const paragraphs=readableParagraphs(doc('<p>—Hola, Ana —dijo Luis.</p><p>—Buenos días.</p>')),items=dialogueSuggestions(paragraphs,viewFor({}),0)
  expect(items[0]).toMatchObject({name:'Luis',quote:'Hola, Ana'});expect(items[1].name).toBe('');expect(items[0].cfi).toContain('Hola, Ana')
 })
 it('AI proposals must be exact, unique quotes in the preview and never become assignments automatically',()=>{
  const paragraphs=readableParagraphs(doc('<p>—Hola.</p><p>—Otra frase.</p>')),view=viewFor({}),items=parsedSpeakerSuggestions(JSON.stringify([{speaker:'Ana',quote:'Hola.'},{speaker:'B',quote:'Inventado'},{speaker:'C',quote:'Otra frase.'}]),paragraphs,view,0,'—Hola.')
  expect(items).toHaveLength(1);expect(items[0].name).toBe('Ana');expect(()=>parsedSpeakerSuggestions('not json',paragraphs,view,0)).toThrow()
 })
 it('normalization bounds resources and removes references to missing characters',()=>{
  const cast=safeCast({characters:[{id:'actor-ana',name:'Ana',rate:20,pitch:-1,voice:'local'}],assignments:[{cfi:'epubcfi(a)',characterId:'missing'}]});expect(cast.assignments).toEqual([]);expect(cast.characters[1]).toMatchObject({name:'Ana',rate:2,pitch:.5});expect(cast.characters[0].id).toBe('narrator')
 })
 it('a local speaker can differ while inheriting the general model, and empty fields keep defaults',()=>{
  const cast={characters:[{id:'actor-ana',name:'Ana',localSpeaker:1}]},settings={...defaults,narrationEnabled:true}
  expect(narrationSettings(settings,cast,'actor-ana')).toMatchObject({localVoice:'es_ES-sharvard-medium',localSpeaker:1})
  expect(narrationSettings({...settings,localSpeaker:1},{characters:[{id:'actor-ana',name:'Ana',localSpeaker:''}]},'actor-ana').localSpeaker).toBe(1)
 })
})
