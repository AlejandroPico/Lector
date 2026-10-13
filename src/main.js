import './style.css'
import 'foliate-js/view.js'
import { Overlayer } from 'foliate-js/overlayer.js'
import { importBook, escapeHTML, metadataText, pdfPageImage } from './books.js'
import { allBooks, fileId, getBook, saveBook, removeBook, defaults, readJSON, writeJSON, effectiveTheme, safeSettings } from './storage.js'
import { SpeechController, validateEndpoint } from './speech.js'
import { lookup, normalizeWord, importDictionary } from './dictionary.js'
import { icon, iconButton } from './icons.js'

const $ = selector => document.querySelector(selector)
const settings = safeSettings(readJSON('lector-settings', {}))
let book, record, selection, apiKey = '', busy = false, saveTimer, loadSequence = 0, searchSequence = 0
let storageWarning = false, focusBeforePanel, imageScale = 1, imageWidth = 0

const rangeControl = (key, label, min, max, step, unit = '') => `<label class="field range-field"><span>${label}<output for="${key}" data-output="${key}">${settings[key]}${unit}</output></span><input id="${key}" type="range" data-setting="${key}" min="${min}" max="${max}" step="${step}" value="${settings[key]}" data-unit="${unit}"></label>`
const check = (key, label) => `<label class="check-field"><input type="checkbox" data-setting="${key}" ${settings[key] ? 'checked' : ''}>${label}</label>`
const themePicker = `<div class="theme-options" role="group" aria-label="Tema">${[['auto', 'Automático'], ['morning', 'Mañana'], ['afternoon', 'Tarde'], ['night', 'Noche'], ['comfort', 'Confort']].map(([value, label]) => `<button class="theme-option" data-theme="${value}" aria-pressed="${settings.theme === value}"><span class="theme-sample ${value}"></span>${label}</button>`).join('')}</div>`

$('#app').innerHTML = `
  <header class="toolbar" aria-label="Controles del lector">
    <div class="toolbar-left">${iconButton('index-toggle', 'index', 'Índice y biblioteca', 'aria-expanded="false" aria-controls="sidebar"')}</div>
    <div class="toolbar-right">
      ${iconButton('open-file', 'open', 'Abrir documento (Ctrl+O)')}
      ${iconButton('audio-toggle', 'play', 'Leer en voz alta', 'disabled')}
      ${iconButton('voice-toggle', 'volume', 'Ajustes de voz', 'aria-expanded="false" aria-controls="voice-panel"')}
      <span class="toolbar-separator"></span>
      ${iconButton('appearance-toggle', 'type', 'Tipografía y página', 'aria-expanded="false" aria-controls="appearance-panel"')}
      ${iconButton('theme-toggle', 'sun', 'Tema', 'aria-expanded="false" aria-controls="theme-panel"')}
      ${iconButton('zen-toggle', 'zen', 'Modo zen (Z)', 'aria-pressed="false"')}
      ${iconButton('fullscreen-toggle', 'expand', 'Pantalla completa (F)')}
      ${iconButton('about-toggle', 'info', 'Acerca de Lector')}
    </div>
  </header>
  <aside id="sidebar" class="sidebar" hidden aria-label="Navegación del libro">
    <div class="sidebar-top"><span id="book-title">Biblioteca</span>${iconButton('sidebar-close', 'close', 'Cerrar índice')}</div>
    <div class="sidebar-tabs" role="tablist" aria-label="Navegación">
      <button role="tab" data-tab="contents" aria-selected="true">Índice</button>
      <button role="tab" data-tab="notes" aria-selected="false">Notas</button>
      <button role="tab" data-tab="library" aria-selected="false">Libros</button>
    </div>
    <section id="contents-tab" role="tabpanel" aria-label="Índice">
      <button id="show-cover" class="text-button cover-button" hidden>${icon('book')}Ver portada</button>
      <form id="search-form" class="search-field"><label class="sr-only" for="search-query">Buscar en el libro</label><input id="search-query" placeholder="Buscar en el libro" type="search"><button aria-label="Buscar" title="Buscar">${icon('search')}</button></form>
      <div id="search-results" hidden></div><nav id="toc" aria-label="Capítulos"><p class="muted small">Abre un libro para ver su índice.</p></nav>
    </section>
    <section id="notes-tab" role="tabpanel" aria-label="Notas" hidden><div class="notes-actions"><button id="add-bookmark" class="text-button">${icon('bookmark')}Marcar página</button><button id="export-notes" class="icon-button" aria-label="Exportar notas" title="Exportar notas">${icon('download')}</button></div><div id="notes-list"></div></section>
    <section id="library-tab" role="tabpanel" aria-label="Biblioteca" hidden><div id="library-list"></div></section>
  </aside>
  <main id="reading-area" aria-label="Libro"><foliate-view id="reader"></foliate-view></main>
  <footer class="reading-footer" hidden>
    ${iconButton('previous-page', 'left', 'Página anterior (←)')}
    <button id="position-button" class="position-button" title="Ir a una posición del libro"><span id="chapter-name"></span><span class="position-divider">·</span><span id="progress-text">0 %</span></button>
    ${iconButton('next-page', 'right', 'Página siguiente (→)')}
    <div id="progress-line" aria-hidden="true"></div>
  </footer>
  <div class="zen-exit"><button id="zen-exit" class="icon-button" title="Salir del modo zen" aria-label="Salir del modo zen">${icon('zen')}</button></div>
  <aside id="appearance-panel" class="panel" role="dialog" aria-labelledby="appearance-title" hidden>
    <div class="panel-heading"><h2 id="appearance-title">Tipografía y página</h2><button class="icon-button panel-close" aria-label="Cerrar">${icon('close')}</button></div>
    <label class="field">Tipografía<select data-setting="font"><option value="Georgia">Georgia</option><option value="Palatino">Palatino</option><option value="Literata">Serif del sistema</option><option value="system">Sistema</option><option value="Verdana">Verdana</option></select></label>
    ${rangeControl('fontSize', 'Tamaño', 14, 36, 1, ' px')}
    ${rangeControl('lineHeight', 'Interlineado', 1.2, 2.4, 0.05)}
    ${rangeControl('paragraphGap', 'Espacio entre párrafos', 0, 2, 0.1, ' em')}
    <label class="field">Columnas<select data-setting="columns"><option value="1">Una</option><option value="2">Dos</option><option value="3">Tres</option></select></label>
    ${rangeControl('width', 'Anchura de lectura', 640, 1800, 20, ' px')}
    ${rangeControl('gutter', 'Separación de columnas', 3, 12, 0.5, ' %')}
    ${check('justify', 'Justificar el texto')}${check('animated', 'Transición suave de página')}
    <button id="reset-appearance" class="text-button reset-button">Restablecer presentación</button>
  </aside>
  <aside id="theme-panel" class="panel compact-panel" role="dialog" aria-labelledby="theme-title" hidden>
    <div class="panel-heading"><h2 id="theme-title">Tema</h2><button class="icon-button panel-close" aria-label="Cerrar">${icon('close')}</button></div>
    ${themePicker}<p class="small muted">Automático: mañana de 7 a 18 h, tarde de 18 a 22 h y noche de 22 a 7 h, según la hora del dispositivo.</p>
  </aside>
  <aside id="voice-panel" class="panel" role="dialog" aria-labelledby="voice-title" hidden>
    <div class="panel-heading"><h2 id="voice-title">Lectura en voz alta</h2><button class="icon-button panel-close" aria-label="Cerrar">${icon('close')}</button></div>
    <label class="field">Servicio<select data-setting="provider"><option value="browser">Voces del navegador</option><option value="openai">OpenAI / API compatible</option></select></label>
    <div id="browser-voice-settings"><label class="field">Voz<select id="browser-voices" data-setting="voice"><option value="">Automática · español</option></select></label><p id="voice-availability" class="small muted"></p>${rangeControl('pitch', 'Tono', 0.5, 1.5, 0.1)}</div>
    <div id="api-voice-settings" hidden>
      <p class="notice small">Este servicio tiene coste por uso, aparte de tu suscripción a ChatGPT. Recibirá el texto que se narre. La voz es generada por IA.</p>
      <label class="field">Dirección del servicio<input type="url" data-setting="endpoint" placeholder="https://api.openai.com/v1/audio/speech"></label>
      <label class="field">Clave de API<input id="api-key" type="password" autocomplete="off" spellcheck="false" placeholder="Se conserva solo durante esta sesión"></label>
      <p class="small muted">La clave se envía al servicio indicado y no se guarda en la biblioteca ni en los ajustes.</p>
      <label class="field">Modelo<input data-setting="model" spellcheck="false"></label>
      <label class="field">Voz<input data-setting="apiVoice" spellcheck="false" list="api-voices"></label>
      <datalist id="api-voices">${['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar'].map(value => `<option value="${value}"></option>`).join('')}</datalist>
      <label class="field">Indicaciones de narración<textarea data-setting="instructions" rows="3"></textarea></label>
      <p class="small muted">Esta versión usa una voz por lectura. El reparto automático de personajes queda para una versión posterior. El resaltado de API sigue la frase, sin sincronización palabra a palabra.</p>
    </div>
    ${rangeControl('rate', 'Velocidad', 0.5, 2, 0.05, ' ×')}${check('highlight', 'Resaltar el texto narrado')}
    <div class="voice-actions"><button id="voice-preview" class="text-button">${icon('play')}Probar voz</button><button id="audio-stop" class="text-button">${icon('stop')}Detener</button></div>
  </aside>
  <div id="selection-menu" class="selection-menu" role="toolbar" aria-label="Texto seleccionado" hidden><button id="define-selection">Consultar</button><button id="annotate-selection">Anotar</button><button id="speak-selection">Leer desde aquí</button></div>
  <dialog id="file-dialog" class="file-dialog" aria-label="Abrir documento">
    <form method="dialog" class="dialog-dismiss">${iconButton('dismiss-file', 'close', 'Cerrar selector')}</form>
    <button id="choose-file" class="choose-file">${icon('open')}<span>Abrir un libro</span></button>
    <span class="file-types">EPUB · MOBI · Word · PDF · TXT</span>
    <div id="resume-list" class="resume-list"></div>
    <label class="check-field local-save"><input id="remember-file" type="checkbox" checked>Guardar el archivo en este navegador</label>
    <p id="file-error" class="error small" role="alert" hidden></p>
  </dialog>
  <dialog id="note-dialog" class="small-dialog" aria-labelledby="note-title"><div class="panel-heading"><h2 id="note-title">Nota de lectura</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><blockquote id="note-quote"></blockquote><label class="field">Tu nota<textarea id="note-text" rows="5" placeholder="Escribe una nota…"></textarea></label><button id="save-note" class="primary-button">Guardar nota</button></dialog>
  <dialog id="dictionary-dialog" class="small-dialog" aria-labelledby="dictionary-word"><div class="panel-heading"><h2 id="dictionary-word"></h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><p id="dictionary-definition"></p><a id="dictionary-external" class="text-link" target="_blank" rel="noopener noreferrer">Consultar en Wikcionario ↗</a><label class="text-button dictionary-import">Importar diccionario propio<input id="dictionary-file" type="file" accept=".json" hidden></label><p class="small muted">Glosario local básico y diccionarios JSON propios. Formato: {"palabra": "definición"}.</p></dialog>
  <dialog id="image-dialog" class="image-dialog" aria-label="Imagen ampliada"><div class="image-toolbar">${iconButton('zoom-out', 'minus', 'Reducir imagen')}<output id="zoom-level">100 %</output>${iconButton('zoom-in', 'plus', 'Ampliar imagen')}${iconButton('zoom-fit', 'expand', 'Ajustar imagen')}<button class="icon-button dialog-close" aria-label="Cerrar imagen">${icon('close')}</button></div><div class="image-stage"><img id="zoom-image" alt=""></div></dialog>
  <dialog id="footnote-dialog" class="small-dialog" aria-labelledby="footnote-title"><div class="panel-heading"><h2 id="footnote-title">Nota del libro</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><div id="footnote-content"></div></dialog>
  <dialog id="about-dialog" class="small-dialog" aria-labelledby="about-title"><div class="panel-heading"><h2 id="about-title">Lector</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><p>Un espacio tranquilo para leer y escuchar tus libros.</p><p class="small muted">Versión 0.1 · EPUB, MOBI, AZW3, DOCX, PDF y TXT. Tus archivos y notas permanecen en este navegador. Las voces disponibles dependen del navegador y del sistema.</p><div class="about-links"><a href="https://github.com/AlejandroPico/Lector" target="_blank" rel="noopener noreferrer">Proyecto ↗</a><a href="https://github.com/AlejandroPico?tab=repositories" target="_blank" rel="noopener noreferrer">Porfolio de proyectos ↗</a></div><p class="small muted">Atajos: ← / → pasar página · Z modo zen · F pantalla completa · Espacio leer o pausar · Ctrl+O abrir · Esc cerrar.</p></dialog>
  <dialog id="position-dialog" class="small-dialog" aria-labelledby="position-title"><div class="panel-heading"><h2 id="position-title">Posición del libro</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><label class="field">Porcentaje de lectura<input id="position-input" type="number" min="0" max="100" step="1"></label><button id="go-position" class="primary-button">Ir</button></dialog>
  <input id="file-input" type="file" accept=".epub,.mobi,.azw3,.docx,.doc,.pdf,.txt,.fb2" hidden>
  <div id="loading" class="loading" role="status" hidden><span class="loading-line"></span><span id="loading-text">Abriendo libro…</span></div>
  <div id="toast" class="toast" role="status" hidden></div>
`

const view = $('#reader')
let toastTimer
function toast(message, duration = 6000) {
  $('#toast').textContent = message; $('#toast').hidden = false
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, duration)
}
const handleError = error => { console.error(error); toast(error.message || 'No se pudo completar la operación.') }
const attempt = fn => async (...args) => { try { await fn(...args) } catch (error) { handleError(error) } }

const speech = new SpeechController({
  view, settings: () => settings, getKey: () => apiKey,
  onState(state) {
    $('#audio-toggle').innerHTML = icon(state === 'playing' ? 'pause' : 'play')
    $('#audio-toggle').classList.toggle('active', ['playing', 'paused', 'loading'].includes(state))
    const label = ({ playing: 'Pausar lectura', paused: 'Continuar lectura', loading: 'Generando audio…', stopped: 'Leer en voz alta' })[state]
    $('#audio-toggle').setAttribute('aria-label', label); $('#audio-toggle').title = label
    $('#audio-toggle').setAttribute('aria-busy', state === 'loading')
  },
  onError: message => { toast(message, 8000); if (settings.provider === 'openai' && !apiKey) togglePanel('voice') },
  onHighlight(range) {
    for (const { doc } of view.renderer?.getContents() ?? []) doc.defaultView.CSS?.highlights?.delete('spoken')
    if (!range || !settings.highlight) return
    const win = range.startContainer.ownerDocument.defaultView
    if (win.Highlight && win.CSS.highlights) win.CSS.highlights.set('spoken', new win.Highlight(range))
  },
})

function themeColors() {
  const style = getComputedStyle(document.documentElement)
  return { bg: style.getPropertyValue('--paper').trim(), ink: style.getPropertyValue('--ink').trim(), accent: style.getPropertyValue('--accent').trim(), mark: style.getPropertyValue('--highlight').trim() }
}

function bookStyles() {
  const colors = themeColors()
  const font = ({ Georgia: 'Georgia, "Times New Roman", serif', Palatino: '"Palatino Linotype", "Book Antiqua", serif',
    Literata: 'ui-serif, Georgia, serif', system: 'system-ui, sans-serif', Verdana: 'Verdana, sans-serif' })[settings.font]
  return `html { color: ${colors.ink} !important; background: ${colors.bg} !important; color-scheme: ${effectiveTheme(settings.theme) === 'night' ? 'dark' : 'light'}; }
    body { font-family: ${font} !important; font-size: ${settings.fontSize}px !important; line-height: ${settings.lineHeight} !important; color: ${colors.ink} !important; background: transparent !important; text-align: ${settings.justify ? 'justify' : 'left'} !important; overflow-wrap: break-word; }
    p, div, li, blockquote { font-family: inherit !important; font-size: inherit !important; line-height: inherit !important; color: inherit !important; }
    p { margin-block: 0 ${settings.paragraphGap}em !important; }
    h1,h2,h3,h4,h5,h6 { font-family: inherit !important; color: inherit !important; font-weight: 500; line-height: 1.35 !important; }
    h1 { font-size: 1.5em; } h2 { font-size: 1.3em; } h3 { font-size: 1.15em; }
    img,svg,image { max-width: 100% !important; max-height: 80vh !important; object-fit: contain; cursor: zoom-in; }
    img { height: auto !important; } figure { margin-inline: 0; } a { color: ${colors.accent}; text-decoration-thickness: 1px; text-underline-offset: 3px; }
    table { max-width: 100%; font-size: .85em; } pre { white-space: pre-wrap; } blockquote { margin-inline: 1.5em; }
    ::selection, ::highlight(spoken) { background: ${colors.mark}; color: ${colors.ink}; }
    .pdf-original { appearance: none; border: 0; border-bottom: 1px solid currentColor; border-radius: 0; padding: 8px 0; background: transparent; color: ${colors.accent}; font: 13px system-ui; cursor: pointer; }
    button:focus-visible,a:focus-visible { outline: 2px solid ${colors.accent}; outline-offset: 4px; }`
}

function applySettings() {
  document.documentElement.dataset.theme = effectiveTheme(settings.theme)
  $('#reading-area').style.maxWidth = `${settings.width}px`
  if (view.renderer) {
    const count = window.innerWidth < 700 ? 1 : settings.columns
    view.renderer.setAttribute('max-column-count', count)
    view.renderer.setAttribute('max-inline-size', `${Math.max(280, (Math.min(settings.width, $('#reading-area').clientWidth) - 32) / count)}px`)
    view.renderer.setAttribute('gap', `${settings.gutter}%`)
    view.renderer.setAttribute('margin', window.innerWidth < 700 ? '16px' : '28px')
    view.renderer.toggleAttribute('animated', settings.animated && !matchMedia('(prefers-reduced-motion: reduce)').matches)
    view.renderer.setStyles?.(bookStyles())
  }
  document.querySelectorAll('[data-setting]').forEach(input => {
    const value = settings[input.dataset.setting]
    if (input.type === 'checkbox') input.checked = value
    else if (document.activeElement !== input) input.value = value
  })
  document.querySelectorAll('[data-output]').forEach(output => {
    const input = document.querySelector(`[data-setting="${output.dataset.output}"]`)
    output.textContent = settings[output.dataset.output] + (input.dataset.unit ?? '')
  })
  document.querySelectorAll('button[data-theme]').forEach(button => button.setAttribute('aria-pressed', button.dataset.theme === settings.theme))
  $('#api-voice-settings').hidden = settings.provider !== 'openai'
  $('#browser-voice-settings').hidden = settings.provider !== 'browser'
  writeJSON('lector-settings', settings)
}

function closePanels() {
  document.querySelectorAll('.panel').forEach(panel => panel.hidden = true)
  document.querySelectorAll('[aria-controls$="-panel"]').forEach(button => button.setAttribute('aria-expanded', 'false'))
  if (focusBeforePanel?.isConnected) focusBeforePanel.focus({ preventScroll: true })
  focusBeforePanel = null
}
function togglePanel(name) {
  const panel = $(`#${name}-panel`), wasOpen = !panel.hidden
  closePanels()
  if (!wasOpen) {
    focusBeforePanel = $(`#${name}-toggle`); panel.hidden = false
    focusBeforePanel.setAttribute('aria-expanded', 'true')
    panel.querySelector('button').focus()
  }
  $('#selection-menu').hidden = true
}
function sidebar(open = $('#sidebar').hidden) {
  $('#sidebar').hidden = !open; document.body.classList.toggle('sidebar-open', open)
  $('#index-toggle').setAttribute('aria-expanded', open)
  requestAnimationFrame(applySettings)
}
function setZen(active) {
  document.body.classList.toggle('zen', active)
  $('#zen-toggle').setAttribute('aria-pressed', active)
  if (active) { closePanels(); sidebar(false) }
}

function syncVoices() {
  const voices = globalThis.speechSynthesis?.getVoices() ?? []
  voices.sort((a, b) => (b.lang.startsWith('es') - a.lang.startsWith('es')) || a.name.localeCompare(b.name))
  $('#browser-voices').innerHTML = '<option value="">Automática · español</option>' + voices.map(voice => `<option value="${escapeHTML(voice.voiceURI)}">${escapeHTML(voice.name)} · ${escapeHTML(voice.lang)}</option>`).join('')
  $('#browser-voices').value = settings.voice
  $('#voice-availability').textContent = voices.length ? `${voices.length} voces disponibles. Las voces de red pueden necesitar conexión.` : 'El navegador todavía no ha cargado sus voces. Si no aparecen, prueba otro navegador o revisa las voces instaladas en el sistema.'
}

function saveRecord() {
  if (!record || !book) return
  const snapshot = { ...record, notes: [...record.notes], updatedAt: Date.now() }
  saveBook(snapshot).catch(() => {
    if (!storageWarning) { storageWarning = true; toast('No se pudo guardar en este navegador. Las notas y el punto de lectura podrían perderse al cerrar.', 10000) }
  })
}

function renderTOC(items, target) {
  const list = document.createElement('ol')
  list.className = 'toc-list'
  for (const item of items) {
    const li = document.createElement('li'), button = document.createElement('button')
    button.className = 'toc-link'; button.textContent = item.label || 'Sin título'; button.dataset.href = item.href
    button.addEventListener('click', attempt(async () => {
      speech.stop(); await view.goTo(item.href); $('#search-results').hidden = true
      if (innerWidth < 900) sidebar(false)
    }))
    li.append(button)
    if (item.subitems?.length) renderTOC(item.subitems, li)
    list.append(li)
  }
  target.append(list)
}

async function updateLibrary() {
  const books = await allBooks()
  const available = books.filter(item => item.file)
  $('#resume-list').replaceChildren()
  available.slice(0, 3).forEach(item => {
    const button = document.createElement('button'); button.className = 'resume-button'
    const label = document.createElement('span'); label.textContent = item.title
    const percent = document.createElement('span'); percent.className = 'muted small'; percent.textContent = `${Math.round((item.fraction ?? 0) * 100)} %`
    button.append(label, percent); button.addEventListener('click', attempt(() => openStored(item.id)))
    $('#resume-list').append(button)
  })
  $('#library-list').replaceChildren()
  if (!books.length) $('#library-list').innerHTML = '<p class="small muted">Los libros que abras aparecerán aquí.</p>'
  books.forEach(item => {
    const row = document.createElement('div'); row.className = 'library-row'
    const button = document.createElement('button'); button.className = 'library-book'; button.textContent = item.title
    button.addEventListener('click', attempt(async () => {
      if (item.file) await openStored(item.id)
      else { toast('Vuelve a elegir el archivo para recuperar sus notas y su posición.'); $('#file-input').click() }
    }))
    const remove = document.createElement('button'); remove.className = 'icon-button'; remove.innerHTML = icon('trash'); remove.title = 'Quitar de la biblioteca'; remove.setAttribute('aria-label', `Quitar ${item.title} de la biblioteca`)
    remove.addEventListener('click', attempt(async () => {
      // Removing a book with notes deserves an explicit, concrete local confirmation.
      if (item.notes?.length && !confirm(`¿Quitar «${item.title}» y sus ${item.notes.length} notas de este navegador?`)) return
      if (record?.id === item.id) { clearTimeout(saveTimer); speech.stop(); view.close(); book?.destroy?.(); book = null; record = null; $('#audio-toggle').disabled = true; $('.reading-footer').hidden = true }
      await removeBook(item.id); await updateLibrary()
    }))
    row.append(button, remove); $('#library-list').append(row)
  })
}

async function openStored(id) {
  const saved = await getBook(id)
  if (!saved?.file) throw new Error('No se encuentra el archivo guardado. Vuelve a abrirlo.')
  const file = new File([saved.file], saved.filename, { type: saved.file.type })
  await openFile(file, saved)
}

async function openFile(file, saved) {
  if (busy) return
  busy = true; const sequence = ++loadSequence
  $('#file-error').hidden = true; closePanels(); speech.stop()
  $('#loading').hidden = false; $('#loading-text').textContent = 'Abriendo libro…'
  let imported
  try {
    const id = saved?.id ?? await fileId(file)
    ++searchSequence
    imported = await importBook(file, text => $('#loading-text').textContent = text)
    saved ??= await getBook(id).catch(() => null)
    const title = metadataText(imported.metadata?.title) || file.name
    const nextRecord = { id, title, filename: file.name, file: $('#remember-file').checked ? file : undefined,
      notes: saved?.notes ?? [], cfi: saved?.cfi, fraction: saved?.fraction ?? 0, updatedAt: Date.now() }
    clearTimeout(saveTimer)
    view.close(); book?.destroy?.(); book = null; record = null
    await view.open(imported)
    book = imported; record = nextRecord
    applySettings()
    await view.init({ lastLocation: nextRecord.cfi, showTextStart: !nextRecord.cfi })
    if (!view.renderer.getContents().length) throw new Error('No se pudo mostrar el primer capítulo del documento.')
    if (sequence !== loadSequence) return
    $('#book-title').textContent = title
    $('#toc').replaceChildren()
    renderTOC(book.toc?.length ? book.toc : book.sections.map((section, index) => ({ label: `Sección ${index + 1}`, href: index })), $('#toc'))
    $('#show-cover').hidden = !book.getCover
    $('#audio-toggle').disabled = false; $('.reading-footer').hidden = false
    $('#search-results').hidden = true; $('#search-query').value = ''
    $('#file-dialog').close(); renderNotes(); saveRecord()
    await updateLibrary().catch(() => {})
    if (book.warning) toast(book.warning, 10000)
  } catch (error) {
    imported?.destroy?.()
    if (book === imported) { view.close(); book = null; record = null; $('#audio-toggle').disabled = true; $('.reading-footer').hidden = true }
    if (!$('#file-dialog').open) $('#file-dialog').showModal()
    $('#file-error').textContent = error.message || 'No se pudo abrir este documento.'; $('#file-error').hidden = false
  } finally { busy = false; $('#loading').hidden = true; $('#file-input').value = '' }
}

view.addEventListener('relocate', ({ detail }) => {
  if (!record) return
  record.cfi = detail.cfi; record.fraction = detail.fraction ?? 0
  $('#chapter-name').textContent = detail.tocItem?.label ?? ''
  $('#progress-text').textContent = `${Math.round(record.fraction * 100)} %`
  $('#progress-line').style.width = `${Math.max(0, Math.min(100, record.fraction * 100))}%`
  document.querySelectorAll('.toc-link').forEach(button => {
    const active = String(button.dataset.href) === String(detail.tocItem?.href)
    button.classList.toggle('current', active)
    if (active) button.setAttribute('aria-current', 'location'); else button.removeAttribute('aria-current')
  })
  clearTimeout(saveTimer); saveTimer = setTimeout(saveRecord, 300)
})

view.addEventListener('load', ({ detail: { doc, index } }) => {
  doc.addEventListener('keydown', onKey)
  doc.addEventListener('pointerdown', () => { closePanels(); $('#selection-menu').hidden = true })
  doc.addEventListener('pointerup', () => {
    setTimeout(() => {
      const selected = doc.defaultView.getSelection()
      if (!selected?.rangeCount || !selected.toString().trim()) return
      const range = selected.getRangeAt(0).cloneRange()
      selection = { quote: selected.toString().trim(), cfi: view.getCFI(index, range), range }
      showSelectionMenu(range, doc)
    }, 0)
  })
  doc.addEventListener('click', attempt(async event => {
    const image = event.target.closest('img,svg')
    if (image) {
      event.preventDefault()
      if (image.tagName.toLowerCase() === 'svg') {
        const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(image)], { type: 'image/svg+xml' }))
        showImage(url, 'Ilustración del libro')
        $('#image-dialog').addEventListener('close', () => URL.revokeObjectURL(url), { once: true })
      } else showImage(image.src, image.alt || 'Imagen del libro')
      return
    }
    const pdfButton = event.target.closest('[data-pdf-page]')
    if (pdfButton && book?.pdf) {
      showImage(await pdfPageImage(book.pdf, Number(pdfButton.dataset.pdfPage)), `Página ${pdfButton.dataset.pdfPage}`)
    }
  }))
})

view.addEventListener('external-link', event => {
  event.preventDefault()
  const href = event.detail.href_
  if (/^https?:|^mailto:/i.test(href)) window.open(href, '_blank', 'noopener,noreferrer')
})

view.addEventListener('link', event => {
  const { a, href } = event.detail
  if (a.getAttribute('epub:type')?.includes('noteref') || a.getAttribute('role') === 'doc-noteref' || a.closest('sup')) {
    event.preventDefault()
    attempt(async () => {
      const target = await book.resolveHref(href)
      const url = await book.sections[target.index].load()
      const doc = new DOMParser().parseFromString(await (await fetch(url)).text(), 'text/html')
      const node = target.anchor?.(doc)
      $('#footnote-content').textContent = node?.textContent?.trim() || 'No se encontró el contenido de esta nota.'
      $('#footnote-dialog').showModal()
    })()
  } else speech.stop()
})

view.addEventListener('draw-annotation', ({ detail }) => detail.draw(Overlayer.underline, { color: themeColors().accent }))
view.addEventListener('create-overlay', ({ detail }) => {
  if (!record) return
  for (const note of record.notes) if (note.kind === 'note') view.addAnnotation({ value: note.cfi }).catch(() => {})
})
view.addEventListener('show-annotation', ({ detail }) => {
  const note = record?.notes.find(item => item.cfi === detail.value)
  if (note) { $('#footnote-title').textContent = 'Tu nota'; $('#footnote-content').textContent = note.text || note.quote; $('#footnote-dialog').showModal() }
})

function showSelectionMenu(range, doc) {
  const rect = range.getBoundingClientRect(), frame = doc.defaultView.frameElement.getBoundingClientRect()
  const menu = $('#selection-menu'); menu.hidden = false
  const width = menu.getBoundingClientRect().width
  menu.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, frame.left + rect.left + rect.width / 2 - width / 2))}px`
  menu.style.top = `${Math.max(56, Math.min(innerHeight - 70, frame.top + rect.top - 44))}px`
  $('#define-selection').disabled = selection.quote.split(/\s+/).length > 1
}

function renderNotes() {
  const list = $('#notes-list'); list.replaceChildren()
  if (!record?.notes.length) { list.innerHTML = '<p class="small muted">Selecciona un fragmento para anotar, o marca la página actual.</p>'; return }
  for (const note of record.notes) {
    const row = document.createElement('div'); row.className = 'note-row'
    const navigate = document.createElement('button'); navigate.className = 'note-link'
    const quote = document.createElement('span'); quote.className = 'note-quote'; quote.textContent = note.kind === 'bookmark' ? `Marcador · ${note.label || Math.round(note.fraction * 100) + ' %'}` : note.quote
    const text = document.createElement('span'); text.className = 'note-body'; text.textContent = note.text
    navigate.append(quote, text); navigate.addEventListener('click', attempt(async () => { speech.stop(); await view.goTo(note.cfi); if (innerWidth < 900) sidebar(false) }))
    const remove = document.createElement('button'); remove.className = 'icon-button'; remove.innerHTML = icon('trash'); remove.title = 'Eliminar nota'; remove.setAttribute('aria-label', 'Eliminar nota')
    remove.addEventListener('click', attempt(async () => {
      record.notes = record.notes.filter(item => item.id !== note.id)
      if (note.kind === 'note') await view.deleteAnnotation({ value: note.cfi })
      saveRecord(); renderNotes()
    }))
    row.append(navigate, remove); list.append(row)
  }
}

function showImage(src, alt) {
  if (!src || !/^(blob:|data:image\/|\/)/i.test(src)) return
  const image = $('#zoom-image'); image.alt = alt; image.src = src
  $('#image-dialog').showModal()
  image.onload = fitImage
  if (image.complete && image.naturalWidth) fitImage()
}
function fitImage() {
  const image = $('#zoom-image'), stage = $('.image-stage')
  imageWidth = Math.min(image.naturalWidth, stage.clientWidth - 48, (stage.clientHeight - 48) * image.naturalWidth / image.naturalHeight)
  imageScale = 1; zoomImage()
}
function zoomImage() { $('#zoom-image').style.width = `${imageWidth * imageScale}px`; $('#zoom-level').textContent = `${Math.round(imageScale * 100)} %` }

async function changePage(direction) {
  if (!book || busy || document.querySelector('dialog[open]')) return
  speech.stop(); $('#selection-menu').hidden = true
  await (direction > 0 ? view.next() : view.prev())
}

function onKey(event) {
  if (event.defaultPrevented) return
  const target = event.target
  if (event.key === 'Escape') {
    closePanels(); $('#selection-menu').hidden = true
    if (document.body.classList.contains('zen')) setZen(false)
    return
  }
  if (target.closest?.('input,textarea,select,[contenteditable="true"]')) return
  if (document.querySelector('dialog[open]')) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') { event.preventDefault(); $('#file-input').click(); return }
  if (event.ctrlKey || event.altKey || event.metaKey) return
  if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); attempt(() => changePage(1))() }
  else if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); attempt(() => changePage(-1))() }
  else if (event.key.toLowerCase() === 'z') setZen(!document.body.classList.contains('zen'))
  else if (event.key.toLowerCase() === 'f') attempt(toggleFullscreen)()
  else if (event.code === 'Space' && book && !target.closest?.('button,a')) { event.preventDefault(); attempt(() => speech.toggle())() }
}
async function toggleFullscreen() {
  if (document.fullscreenElement) await document.exitFullscreen()
  else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen()
  else toast('Este navegador no permite activar la pantalla completa desde la aplicación.')
}

$('#index-toggle').onclick = () => sidebar()
$('#sidebar-close').onclick = () => sidebar(false)
$('#open-file').onclick = () => { updateLibrary().catch(() => {}); $('#file-dialog').showModal() }
$('#choose-file').onclick = () => $('#file-input').click()
$('#dismiss-file').onclick = () => $('#file-dialog').close()
$('#file-input').onchange = () => { if ($('#file-input').files[0]) openFile($('#file-input').files[0]) }
$('#audio-toggle').onclick = attempt(() => speech.toggle())
$('#audio-stop').onclick = () => speech.stop()
$('#zen-toggle').onclick = () => setZen(!document.body.classList.contains('zen'))
$('#zen-exit').onclick = () => setZen(false)
$('#fullscreen-toggle').onclick = attempt(toggleFullscreen)
$('#about-toggle').onclick = () => { closePanels(); $('#about-dialog').showModal() }
$('#previous-page').onclick = attempt(() => changePage(-1))
$('#next-page').onclick = attempt(() => changePage(1))
for (const name of ['appearance', 'theme', 'voice']) $(`#${name}-toggle`).onclick = () => togglePanel(name)
document.querySelectorAll('.panel-close').forEach(button => button.onclick = closePanels)
document.querySelectorAll('.dialog-close').forEach(button => button.onclick = () => button.closest('dialog').close())
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => { const rect = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close() })
})
document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => {
  document.querySelectorAll('[data-tab]').forEach(tab => tab.setAttribute('aria-selected', tab === button))
  for (const name of ['contents', 'notes', 'library']) $(`#${name}-tab`).hidden = name !== button.dataset.tab
  if (button.dataset.tab === 'library') updateLibrary().catch(handleError)
})
document.querySelectorAll('[data-setting]').forEach(input => {
  input.addEventListener(['range', 'checkbox'].includes(input.type) || input.tagName === 'SELECT' ? 'input' : 'change', () => {
    if (['provider', 'voice', 'rate', 'pitch', 'endpoint', 'model', 'apiVoice', 'instructions'].includes(input.dataset.setting)) speech.stop()
    settings[input.dataset.setting] = input.type === 'checkbox' ? input.checked : input.type === 'range' || input.dataset.setting === 'columns' ? Number(input.value) : input.value
    Object.assign(settings, safeSettings(settings)); applySettings()
  })
})
$('#api-key').oninput = event => { speech.stop(); apiKey = event.target.value.trim() }
document.querySelectorAll('button[data-theme]').forEach(button => button.onclick = () => { settings.theme = button.dataset.theme; applySettings() })
$('#reset-appearance').onclick = () => { for (const key of ['font', 'fontSize', 'lineHeight', 'paragraphGap', 'columns', 'width', 'gutter', 'justify', 'animated']) settings[key] = defaults[key]; applySettings() }
$('#voice-preview').onclick = attempt(async () => {
  speech.stop()
  const sample = { text: 'La tarde caía despacio. Por un momento, todo quedó en silencio.' }
  if (settings.provider === 'openai') {
    validateEndpoint(settings.endpoint)
    if (!apiKey) { toast('Introduce una clave de API para probar esta voz.'); return }
    try { await speech.speakAPI(sample, speech.run) } finally { speech.stop() }
  } else {
    if (!globalThis.speechSynthesis) { toast('Este navegador no dispone de lectura en voz alta.'); return }
    speech.setState('playing'); try { await speech.speakBrowser(sample, speech.run) } finally { speech.stop() }
  }
})
$('#show-cover').onclick = attempt(async () => {
  const cover = await book?.getCover?.()
  if (!cover) { toast('Este libro no incluye una portada identificada.'); return }
  const url = URL.createObjectURL(cover)
  showImage(url, `Portada de ${record.title}`)
  $('#image-dialog').addEventListener('close', () => URL.revokeObjectURL(url), { once: true })
})
$('#define-selection').onclick = () => {
  const word = normalizeWord(selection.quote)
  $('#dictionary-word').textContent = word
  $('#dictionary-definition').textContent = lookup(word) || 'Esta palabra no está en el glosario local. Puedes consultarla en Wikcionario o importar un diccionario propio.'
  $('#dictionary-external').href = `https://es.wiktionary.org/wiki/${encodeURIComponent(word)}`
  $('#selection-menu').hidden = true; $('#dictionary-dialog').showModal()
}
$('#dictionary-file').onchange = attempt(async () => {
  const file = $('#dictionary-file').files[0]
  if (!file) return
  if (file.size > 4 * 1024 * 1024) throw new Error('El diccionario JSON puede ocupar como máximo 4 MB.')
  const count = importDictionary(JSON.parse(await file.text()))
  $('#dictionary-definition').textContent = lookup($('#dictionary-word').textContent) || 'Palabra no incluida en el diccionario importado.'
  toast(`Diccionario importado · ${count.toLocaleString('es')} palabras`)
  $('#dictionary-file').value = ''
})
$('#annotate-selection').onclick = () => {
  $('#note-quote').textContent = selection.quote; $('#note-text').value = ''
  $('#selection-menu').hidden = true; $('#note-dialog').showModal(); $('#note-text').focus()
}
$('#save-note').onclick = attempt(async () => {
  if (!record || !selection) return
  const text = $('#note-text').value.trim()
  if (!text) { $('#note-text').focus(); return }
  const note = { id: crypto.randomUUID(), kind: 'note', cfi: selection.cfi, quote: selection.quote, text, createdAt: Date.now() }
  record.notes.push(note); await view.addAnnotation({ value: note.cfi })
  saveRecord(); renderNotes(); $('#note-dialog').close(); toast('Nota guardada')
})
$('#speak-selection').onclick = attempt(async () => {
  speech.stop(); await view.select(selection.cfi); $('#selection-menu').hidden = true; await speech.toggle(selection.range)
})
$('#add-bookmark').onclick = () => {
  if (!record || !view.lastLocation) return
  if (record.notes.some(note => note.kind === 'bookmark' && note.cfi === record.cfi)) { toast('Esta posición ya tiene un marcador.'); return }
  record.notes.push({ id: crypto.randomUUID(), kind: 'bookmark', cfi: record.cfi, fraction: record.fraction, label: view.lastLocation.tocItem?.label ?? '', text: '', createdAt: Date.now() })
  saveRecord(); renderNotes(); toast('Página marcada')
}
$('#export-notes').onclick = () => {
  if (!record) return
  const url = URL.createObjectURL(new Blob([JSON.stringify({ book: record.title, file: record.filename, notes: record.notes }, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${record.title.replace(/[\\/:*?"<>|]/g, '-')}-notas.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
$('#zoom-in').onclick = () => { imageScale = Math.min(5, imageScale + 0.25); zoomImage() }
$('#zoom-out').onclick = () => { imageScale = Math.max(0.25, imageScale - 0.25); zoomImage() }
$('#zoom-fit').onclick = fitImage
$('#image-dialog').addEventListener('close', () => { $('#zoom-image').removeAttribute('src') })
$('#position-button').onclick = () => { $('#position-input').value = Math.round((record?.fraction ?? 0) * 100); $('#position-dialog').showModal() }
$('#go-position').onclick = attempt(async () => {
  if (!book || !$('#position-input').reportValidity()) return
  speech.stop(); await view.goToFraction(Number($('#position-input').value) / 100); $('#position-dialog').close()
})
$('#search-form').onsubmit = attempt(async event => {
  event.preventDefault()
  const query = $('#search-query').value.trim(); const sequence = ++searchSequence
  if (!book) return
  view.clearSearch(); $('#search-results').replaceChildren(); $('#search-results').hidden = !query
  if (!query) return
  const status = document.createElement('p'); status.className = 'small muted'; status.textContent = 'Buscando…'; $('#search-results').append(status)
  let count = 0
  for await (const result of view.search({ query, matchCase: false })) {
    if (sequence !== searchSequence) return
    if (result === 'done') break
    const matches = result.subitems ?? (result.cfi ? [result] : [])
    for (const match of matches) {
      const button = document.createElement('button'); button.className = 'search-result'
      const excerpt = match.excerpt
      button.textContent = typeof excerpt === 'string' ? excerpt : `${excerpt?.pre ?? ''}${excerpt?.match ?? ''}${excerpt?.post ?? ''}`
      button.onclick = attempt(async () => { speech.stop(); await view.goTo(match.cfi); if (innerWidth < 900) sidebar(false) })
      $('#search-results').append(button); count++
      if (count >= 100) break
    }
    if (count >= 100) break
  }
  status.textContent = count ? `${count}${count >= 100 ? '+' : ''} resultados` : 'No se encontraron coincidencias.'
})

document.addEventListener('keydown', onKey)
document.addEventListener('pointerdown', event => {
  if (!event.target.closest('.panel,.toolbar,dialog')) closePanels()
  if (!event.target.closest('#selection-menu,dialog')) $('#selection-menu').hidden = true
})
document.addEventListener('dragover', event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault() })
document.addEventListener('drop', event => { if (event.dataTransfer.files.length) { event.preventDefault(); openFile(event.dataTransfer.files[0]) } })
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(saveTimer); saveRecord() } })
window.addEventListener('pagehide', () => { saveRecord(); speech.stop() })
window.addEventListener('resize', () => { $('#selection-menu').hidden = true; applySettings() })
globalThis.speechSynthesis?.addEventListener('voiceschanged', syncVoices)
setInterval(() => { if (settings.theme === 'auto') applySettings() }, 60000)
applySettings(); syncVoices()
updateLibrary().catch(() => toast('El almacenamiento local no está disponible. Puedes abrir un libro, pero no se guardará al cerrar.'))
$('#file-dialog').showModal()
