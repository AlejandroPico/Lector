import {it,expect} from 'vitest'
import {chapterExcerpt} from '../src/chapter-preview.js'
const documentOf=html=>new DOMParser().parseFromString(html,'text/html')
it('preserves inline words and direct text in order without executing or returning markup',()=>{
 const doc=documentOf('<body>Texto inicial<p>Una <em>palabra</em> especial.</p><blockquote>Antes<p>Interior</p>Después</blockquote><script>malicioso()</script><p hidden>Oculto</p><img src="https://example.com/x">Final</body>')
 expect(chapterExcerpt(doc).blocks.map(b=>b.text)).toEqual(['Texto inicial','Una palabra especial.','Antes','Interior','Después','Final'])
 expect(doc.querySelector('script')).not.toBeNull()
})
it('starts at subchapter anchors and a precise range without including earlier text',()=>{
 const doc=documentOf('<h1>Antes</h1><p id="target">Un texto especial.</p><p>Después</p>')
 expect(chapterExcerpt(doc,d=>d.getElementById('target')).blocks[0].text).toBe('Un texto especial.')
 const anchor=d=>{const range=d.createRange();range.setStart(d.getElementById('target').firstChild,9);return range}
 expect(chapterExcerpt(doc,anchor).blocks[0].text).toBe('especial.')
 expect(()=>chapterExcerpt(doc,()=>null)).toThrow('No se encontró')
})
it('bounds long samples and keeps a useful final paragraph at 100 percent',()=>{
 const doc=documentOf('<p>'+('palabra '.repeat(1000))+'</p><p>Último párrafo.</p>\n')
 const result=chapterExcerpt(doc,0,140);expect(result.blocks.reduce((n,b)=>n+b.text.length,0)).toBeLessThanOrEqual(140);expect(result.truncated).toBe(true)
 expect(chapterExcerpt(doc,1).blocks.map(b=>b.text)).toEqual(['Último párrafo.'])
})
it('keeps an inert sample even when an anchor is inside excluded content',()=>{
 const doc=documentOf('<p>Texto</p><style id="style">.x{}</style><p>Después</p>')
 expect(chapterExcerpt(doc,d=>d.getElementById('style')).blocks.map(b=>b.text)).toEqual(['Después'])
 expect(chapterExcerpt(documentOf('<p hidden>Oculto</p>')).blocks).toEqual([])
})
