import DOMPurify from 'dompurify'
import { makeBook } from 'foliate-js/view.js'
import {pdfLines,orderedPDFLines,repeatedMargins} from './pdf-layout.js'

export const escapeHTML = text => String(text ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

export function sanitizeBookHTML(html) {
  return DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    FORBID_TAGS: ['script', 'style', 'link', 'iframe', 'object', 'embed', 'form', 'input', 'video', 'audio', 'source', 'meta', 'base'],
    FORBID_ATTR: ['style', 'srcset'],
    ALLOW_DATA_ATTR: true,
    ADD_TAGS: ['image'],
    ADD_ATTR: ['xlink:href', 'epub:type'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|blob):|data:image\/(?:png|jpeg|gif|webp|svg\+xml);|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  }).replace(/<(img|image)\b[^>]*>/gi, tag => tag.replace(/\b(src|href|xlink:href)="([^"]*)"/gi,
    (attribute, _key, url) => /^(blob:|data:image\/|\/)/i.test(url) ? attribute : ''))
}

export function metadataText(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(metadataText).join(', ')
  if (value && typeof value === 'object') return metadataText(value.name ?? value.es ?? value.en ?? Object.values(value)[0])
  return ''
}

function wrapBook(book) {
  const urls = new Map()
  const originalDestroy = book.destroy?.bind(book)
  book.sections.forEach((section, index) => {
    const originalLoad = section.load.bind(section)
    const originalUnload = section.unload?.bind(section)
    section.load = async () => {
      if (urls.has(index)) return urls.get(index)
      const source = await originalLoad()
      const response = await fetch(source)
      if (!response.ok) throw new Error('No se pudo cargar este capítulo.')
      const html = sanitizeBookHTML(await response.text())
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
      urls.set(index, url)
      return url
    }
    section.unload = () => {
      if (urls.has(index)) URL.revokeObjectURL(urls.get(index))
      urls.delete(index)
      originalUnload?.()
    }
  })
  book.destroy = () => { for (const url of urls.values()) URL.revokeObjectURL(url); urls.clear(); originalDestroy?.() }
  return book
}

export function htmlBook(parts, title, extra = {}) {
  const urls = new Map()
  const sections = parts.map((part, index) => ({
    id: `section-${index}`, size: part.html.length,
    load() {
      if (!urls.has(index)) {
        const html = sanitizeBookHTML(`<!doctype html><html lang="es"><head><title>${escapeHTML(title)}</title></head><body>${part.html}</body></html>`)
        urls.set(index, URL.createObjectURL(new Blob([html], { type: 'text/html' })))
      }
      return urls.get(index)
    },
    createDocument() { return new DOMParser().parseFromString(sanitizeBookHTML(part.html), 'text/html') },
    unload() { URL.revokeObjectURL(urls.get(index)); urls.delete(index) },
    resolveHref(href) { return href.startsWith('#') ? `section-${index}${href}` : href },
  }))
  const resolve = href => {
    const [path, fragment] = href.split('#')
    const index = Number(path.replace('section-', ''))
    return { index: Number.isFinite(index) ? index : 0, anchor: doc => fragment ? doc.getElementById(fragment) : null }
  }
  return {
    metadata: { title, language: 'es' }, sections,
    toc: parts.map((part, index) => ({ label: part.label, href: `section-${index}`, subitems: part.subitems ?? [] })),
    resolveHref: resolve, splitTOCHref: href => href.split('#'),
    getTOCFragment: (doc, id) => id ? doc.getElementById(id) : doc.body,
    isExternal: href => /^https?:|^mailto:/i.test(href),
    destroy() { for (const url of urls.values()) URL.revokeObjectURL(url); urls.clear(); extra.pdfCleanup?.() },
    ...extra,
  }
}

function partsFromHTML(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const parts = []
  let part = { label: 'Documento', html: '', subitems: [] }
  let id = 0
  for (const node of doc.body.childNodes) {
    if (node.nodeType === Node.ELEMENT_NODE && /^H[1-6]$/.test(node.tagName)) {
      node.id = `heading-${id++}`
      if (node.tagName === 'H1' || !parts.length && !part.html.trim()) {
        if (part.html.trim()) parts.push(part)
        part = { label: node.textContent.trim(), html: '', subitems: [] }
      } else part.subitems.push({ label: node.textContent.trim(), href: `section-${parts.length}#${node.id}`, subitems: [] })
    }
    part.html += node.nodeType === Node.ELEMENT_NODE ? node.outerHTML : escapeHTML(node.textContent)
  }
  if (part.html.trim()) parts.push(part)
  return parts.length ? parts : [{ label: 'Documento', html: '<p>El documento no contiene texto.</p>' }]
}

async function importPDF(file, onProgress, options={}) {
  const pdfjs = await import('pdfjs-dist')
  const { default: worker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const task = pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false })
  const pdf = await task.promise
  const parts = [],pages=[]
  let textPages = 0
  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress(`Leyendo PDF · ${i} / ${pdf.numPages}`)
    const page = await pdf.getPage(i)
    const text = await page.getTextContent()
    pages.push({height:page.getViewport({scale:1}).height,lines:pdfLines(text.items,page.getViewport({scale:1}).height)})
    const lines = []
    let line = '', lastY
    for (const item of text.items) {
      if (!('str' in item)) continue
      const y = item.transform[5]
      if (lastY != null && Math.abs(y - lastY) > 3 && line.trim()) { lines.push(line.trim()); line = '' }
      line += item.str + ' '
      lastY = y
      if (item.hasEOL && line.trim()) { lines.push(line.trim()); line = ''; lastY = null }
    }
    if (line.trim()) lines.push(line.trim())
    pages.at(-1).originalLines=lines.map(text=>({text,y:pages.at(-1).lines.find(line=>text.includes(line.text))?.y??pages.at(-1).height/2}))
    const content = lines.join(' ').trim()
    if (content) textPages++
    parts.push({ label: `Página ${i}`, html:
      (content ? `<p>${escapeHTML(content)}</p>` : '<p data-no-speech="true">Esta página no tiene texto seleccionable.</p>') +
      `<p data-no-speech="true"><button class="pdf-original" data-pdf-page="${i}">Ver página original</button></p>` })
    page.cleanup()
  }
  const repeated=repeatedMargins(pages)
  for(let i=0;i<parts.length;i++){
    const correction=options.pdfText?.[i]
    const content=typeof correction?.text==='string'?correction.text:orderedPDFLines(pages[i],options.pdfOptions,repeated).map(line=>line.text).join('\n')
    parts[i].html=(content.trim()?content.split(/\n\s*\n/).map(text=>`<p>${escapeHTML(text).replace(/\n/g,'<br> ')}</p>`).join(''):'<p data-no-speech="true">Esta página no tiene texto seleccionable.</p>')+`<p data-no-speech="true"><button class="pdf-original" data-pdf-page="${i+1}">Ver página original</button></p>`
  }
  const metadata = await pdf.getMetadata().catch(() => ({}))
  const book = htmlBook(parts, metadata.info?.Title || file.name.replace(/\.[^.]+$/, ''), { pdf,pdfPages:pages,pdfRepeated:repeated,pdfCleanup:()=>task.destroy().catch(()=>{}) })
  const outline = await pdf.getOutline().catch(() => null)
  if (outline?.length) {
    const map = async items => Promise.all(items.map(async item => {
      const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest
      let index = 0
      if (dest?.[0]) index = typeof dest[0] === 'number' ? dest[0] : await pdf.getPageIndex(dest[0])
      return { label: item.title, href: `section-${index}`, subitems: await map(item.items ?? []) }
    }))
    book.toc = await map(outline)
  }
  book.warning = textPages||Object.values(options.pdfText??{}).some(item=>item.text?.trim()) ? 'El PDF se presenta en modo lectura. Las ilustraciones y la maquetación están disponibles en «Ver página original».'
    : 'Este PDF parece escaneado. Puedes ver sus páginas originales; para narrarlo hace falta reconocimiento de texto (OCR).'
  return book
}

export async function importBook(file, onProgress = () => {}, options={}) {
  if (!file.size) throw new Error('El archivo está vacío.')
  if (file.size > 100 * 1024 * 1024) throw new Error('El límite de esta versión es de 100 MB por archivo.')
  const extension = file.name.split('.').pop().toLowerCase()
  if (['epub', 'mobi', 'azw3', 'fb2'].includes(extension)) {
    if (['mobi', 'azw3'].includes(extension) && file.size >= 86) {
      const pdb = new DataView(await file.slice(0, 86).arrayBuffer())
      const offset = pdb.getUint32(78)
      if (offset + 14 <= file.size) {
        const header = new DataView(await file.slice(offset, offset + 14).arrayBuffer())
        if (header.getUint16(12) !== 0) throw new Error('Este libro está protegido con DRM. Abre una copia sin protección compatible con el lector.')
      }
    }
    try { return wrapBook(await makeBook(file)) }
    catch (error) {
      if (/encrypt|DRM/i.test(error.message)) throw new Error('Este libro está protegido con DRM. Abre una copia sin protección compatible con el lector.')
      throw new Error('No se pudo abrir el libro. Comprueba que el archivo es válido y no está protegido con DRM.', { cause: error })
    }
  }
  if (extension === 'pdf') return importPDF(file, onProgress,options)
  if (extension === 'docx') {
    const { default: mammoth } = await import('mammoth/mammoth.browser.js')
    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
    return htmlBook(partsFromHTML(result.value), file.name.replace(/\.[^.]+$/, ''))
  }
  if (extension === 'txt') {
    const text = await file.text()
    const paragraphs = text.split(/\n\s*\n/).filter(value => value.trim())
    const html = paragraphs.map(value => `<p>${escapeHTML(value.trim()).replace(/\n/g, '<br>')}</p>`).join('')
    return htmlBook([{ label: 'Texto', html }], file.name.replace(/\.[^.]+$/, ''))
  }
  if (extension === 'doc') throw new Error('Para documentos Word antiguos (.doc), guarda primero una copia como .docx.')
  throw new Error('Formato no compatible. Puedes abrir EPUB, MOBI, AZW3, DOCX, PDF o TXT.')
}

export async function pdfPageImage(pdf, number) {
  const page = await pdf.getPage(number)
  const viewport = page.getViewport({ scale: Math.min(2, 1800 / page.getViewport({ scale: 1 }).width) })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width; canvas.height = viewport.height
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  const image = canvas.toDataURL('image/png')
  page.cleanup(); canvas.width = 0; canvas.height = 0
  return image
}
