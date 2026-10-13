import { it, expect } from 'vitest'
import { documentSpeech, speechFrom } from '../src/speech.js'

it('resumes at a clicked word inside a sentence and keeps word ranges aligned', () => {
  const doc = new DOMParser().parseFromString('<p>El jardín estaba en calma. Elena abrió el libro.</p>','text/html')
  const text = doc.querySelector('p').firstChild
  const range = doc.createRange(); range.setStart(text,10); range.setEnd(text,16)
  const segments = speechFrom(documentSpeech(doc),range,true)
  expect(segments.map(item=>item.text)).toEqual(['estaba en calma.','Elena abrió el libro.'])
  expect(segments[0].range.toString()).toBe('estaba en calma.')
  expect(segments[0].wordRange(7,2).toString()).toBe('en')
})
