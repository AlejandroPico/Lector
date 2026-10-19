import { it, expect } from 'vitest'
import { documentSpeech, speechFrom,speechCheckpoint } from '../src/speech.js'

it('resumes at a clicked word inside a sentence and keeps word ranges aligned', () => {
  const doc = new DOMParser().parseFromString('<p>El jardín estaba en calma. Elena abrió el libro.</p>','text/html')
  const text = doc.querySelector('p').firstChild
  const range = doc.createRange(); range.setStart(text,10); range.setEnd(text,16)
  const segments = speechFrom(documentSpeech(doc),range,true)
  expect(segments.map(item=>item.text)).toEqual(['estaba en calma.','Elena abrió el libro.'])
  expect(segments[0].range.toString()).toBe('estaba en calma.')
  expect(segments[0].wordRange(7,2).toString()).toBe('en')
})

it('does not count hidden DOM text when continuing at a clicked word',()=>{
  const doc=new DOMParser().parseFromString('<p>El jardín <span hidden>contenido que no se narra</span><em>estaba</em> en calma.</p>','text/html')
  const node=doc.querySelector('em').firstChild,point=doc.createRange();point.setStart(node,0);point.setEnd(node,6)
  const segment=speechFrom(documentSpeech(doc),point,true)[0]
  expect(segment.text).toBe('estaba en calma.')
  expect(segment.wordRange(10,5).toString()).toBe('calma')
})

it('restores an Android checkpoint through pronunciation offsets instead of losing the spoken position',async()=>{
 const doc=new DOMParser().parseFromString('<p>El Dr. Pérez abrió el libro.</p>','text/html'),node=doc.querySelector('p').firstChild
 const view={book:{sections:[{createDocument:async()=>doc}]},resolveNavigation:()=>({index:0,anchor:()=>{const range=doc.createRange();range.setStart(node,0);range.setEnd(node,node.length);return range}}),getCFI:(_index,range)=>`at:${range.startOffset}`}
 const cfi=await speechCheckpoint(view,{cfi:'epubcfi(test)',charIndex:10},{language:'es',rate:1,pitch:1,pronunciationsEnabled:true,pronunciations:[{from:'Dr.',to:'doctor'}]})
 expect(cfi).toBe('at:7')
})
