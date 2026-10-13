import { describe, expect, it, beforeEach } from 'vitest'
import { splitSentences, documentSpeech, validateEndpoint } from '../src/speech.js'
import { effectiveTheme, safeSettings } from '../src/storage.js'
import { lookup, importDictionary } from '../src/dictionary.js'

describe('reading settings', () => {
  it('switches automatic themes at their boundaries', () => {
    expect(effectiveTheme('auto', 6)).toBe('night')
    expect(effectiveTheme('auto', 7)).toBe('morning')
    expect(effectiveTheme('auto', 18)).toBe('afternoon')
    expect(effectiveTheme('auto', 22)).toBe('night')
    expect(effectiveTheme('comfort', 2)).toBe('comfort')
  })
  it('validates persisted settings and keeps zero paragraph spacing', () => {
    const settings = safeSettings({ fontSize: 9999, columns: 2.4, theme: 'broken', font: 'bad', paragraphGap: 0 })
    expect(settings.fontSize).toBe(36)
    expect(settings.columns).toBe(2)
    expect(settings.theme).toBe('auto')
    expect(settings.font).toBe('Georgia')
    expect(settings.paragraphGap).toBe(0)
  })
})

describe('speech preserves the text', () => {
  it('segments punctuation and long sentences without losing words', () => {
    const text = 'La tarde caía. ¿Vendrás mañana? ' + 'palabra '.repeat(600)
    const segments = splitSentences(text)
    expect(segments.every(segment => segment.text.length <= 1600)).toBe(true)
    expect(segments.map(segment => segment.text).join(' ').replace(/\s+/g, ' ').trim()).toBe(text.replace(/\s+/g, ' ').trim())
    for (const segment of segments) expect(text.slice(segment.start, segment.end)).toBe(segment.text)
  })
  it('maps highlighting across inline formatting and excludes controls', () => {
    document.body.innerHTML = '<p>El <em>sosiego</em> regresó. Una pausa.</p><p>1945 fue un año.</p><p data-no-speech="true">No leer.</p><button>Ver página</button>'
    const sentences = documentSpeech(document)
    expect(sentences.map(segment => segment.text)).toEqual(['El sosiego regresó.', 'Una pausa.', '1945 fue un año.'])
    expect(sentences[0].range.toString()).toBe('El sosiego regresó.')
    expect(sentences[0].wordRange(3, 7).toString()).toBe('sosiego')
  })
  it('restricts credentials to HTTPS or a local proxy and rejects redirects/URL credentials', () => {
    expect(validateEndpoint('https://api.openai.com/v1/audio/speech')).toContain('https://')
    expect(validateEndpoint('http://localhost:3000/voice')).toContain('localhost')
    for (const address of ['http://example.com/voice', 'https://user:secret@example.com', 'javascript:alert(1)', 'https://example.com?key=abc']) {
      expect(() => validateEndpoint(address)).toThrow()
    }
  })
})

describe('local dictionary', () => {
  beforeEach(() => localStorage.clear())
  it('normalizes words and imports custom definitions', () => {
    expect(lookup('«Sosiego»')).toContain('tranquilidad')
    expect(importDictionary({ testimonio: 'Declaración de una persona.' })).toBe(1)
    expect(lookup('Testimonio')).toBe('Declaración de una persona.')
    expect(() => importDictionary({ bad: 42 })).toThrow()
  })
})
