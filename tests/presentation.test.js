import { describe, it, expect } from 'vitest'
import { fonts, themes, selectBrowserVoice, validateTheme } from '../src/presentation.js'
import { safeSettings } from '../src/storage.js'
import { scanDirectory, groupDirectory, readMetadata } from '../src/folders.js'
import { detectLanguage, languages, t, translationCount } from '../src/i18n.js'

describe('presentation and localization', () => {
  it('restores personal theme identity and rejects CSS values or excessive margins',()=>{
    const theme=validateTheme({label:'Mi tema',colors:themes[2].colors})
    const restored=safeSettings({theme:theme.id,customThemes:[theme],marginOuter:999,marginInner:-40})
    expect(restored.theme).toBe(theme.id);expect(restored.customThemes[0].id).toBe(theme.id)
    expect(restored.marginOuter).toBe(160);expect(restored.marginInner).toBe(0)
    expect(()=>validateTheme({label:'Malicioso',colors:Array(8).fill('url(javascript:alert(1))')})).toThrow()
    expect(safeSettings({theme:theme.id,customThemes:[{...theme,colors:[]}]}).theme).toBe('auto')
  })
  it('has twenty distinct themes, twenty base typefaces and ten complete language catalogs', () => {
    expect(themes).toHaveLength(20); expect(fonts.length).toBeGreaterThanOrEqual(20)
    expect(new Set(themes.map(theme=>theme.id)).size).toBe(20)
    expect(themes.find(theme=>theme.id==='contrast').colors[0]).toBe('#000000')
    expect(translationCount).toBeGreaterThan(140)
    for (const language of Object.keys(languages)) {
      expect(t('Abrir un libro',language)).toBeTruthy()
      if (language !== 'es') expect(t('Idioma de la interfaz',language)).not.toBe('Idioma de la interfaz')
    }
  })
  it('detects language variants and uses an explicit override', () => {
    expect(detectLanguage('auto',['ca-ES','es-ES'])).toBe('ca')
    expect(detectLanguage('auto',['zh-Hans-CN'])).toBe('zh')
    expect(detectLanguage('auto',['hi-IN'])).toBe('hi')
    expect(detectLanguage('fr',['es-ES'])).toBe('fr')
    expect(detectLanguage('auto',['nl-NL'])).toBe('en')
  })
  it('prefers a natural matching voice but honors manual voice selection', () => {
    const voices = [
      { voiceURI:'system',name:'System Spanish',lang:'es-ES',default:true },
      { voiceURI:'google',name:'Google español',lang:'es-ES' },
      { voiceURI:'english',name:'Natural English',lang:'en-US' },
    ]
    expect(selectBrowserVoice(voices,'','es').voiceURI).toBe('google')
    expect(selectBrowserVoice(voices,'system','es').voiceURI).toBe('system')
    expect(selectBrowserVoice(voices,'','en-US').voiceURI).toBe('english')
    expect(selectBrowserVoice(voices,'voice-from-another-browser','es')).toBeNull()
  })
  it('prefers the requested country before selecting a natural voice from another region',()=>{
    const voices=[{voiceURI:'latin',name:'Google español',lang:'es-MX'},{voiceURI:'spain',name:'Microsoft Helena',lang:'es-ES'}]
    expect(selectBrowserVoice(voices,'','es-ES').voiceURI).toBe('spain')
    expect(selectBrowserVoice(voices,'latin','es-ES').voiceURI).toBe('latin')
  })
})

describe('Calibre folder catalog', () => {
  const file = name => ({ kind:'file', name, getFile() { throw new Error('File contents must not be read during scanning') } })
  const directory = (name,children) => ({ kind:'directory',name,async *values() { yield* children } })
  it('groups Calibre formats and scans recursively without reading any content', async () => {
    const entries = [file('Libro.epub'),file('Libro.mobi'),file('metadata.opf'),file('cover.jpg')]
    const root = directory('Libros',[directory('Autor',[directory('Libro (42)',entries)])])
    const catalog = await scanDirectory(root)
    expect(catalog).toHaveLength(1)
    expect(catalog[0].title).toBe('Libro'); expect(catalog[0].author).toBe('Autor')
    expect(catalog[0].formats.map(format=>format.extension)).toEqual(['epub','mobi'])
    expect(catalog[0].cover.name).toBe('cover.jpg')
    expect(groupDirectory([file('Uno.epub'),file('Dos.epub')],['Libros'])).toHaveLength(2)
  })
  it('supports cancellation before any entries are accessed', async () => {
    const controller = new AbortController(); controller.abort()
    await expect(scanDirectory(directory('Libros',[]),{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'})
  })
  it('reads OPF metadata only on explicit request, including namespace names', async () => {
    const entry = { metadata: { async getFile() { return {size:200,text:async()=>'<package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>Nuevo título</dc:title><dc:creator>Autora</dc:creator><dc:language>ca</dc:language></metadata></package>'} } } }
    expect(await readMetadata(entry)).toEqual({title:'Nuevo título',author:'Autora',language:'ca'})
  })
})
