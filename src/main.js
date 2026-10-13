import './style.css'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import '@fontsource/lexend/400.css'
import '@fontsource/lexend/600.css'
import faviconURL from '../favicon.svg?url'
import 'foliate-js/view.js'
import { Overlayer } from 'foliate-js/overlayer.js'
import { importBook, escapeHTML, metadataText, pdfPageImage } from './books.js'
import { allBooks, allFolders, saveFolder, removeFolder, allFonts, saveFont, removeFont, fileId, getBook, saveBook, removeBook, defaults, readJSON, writeJSON, effectiveTheme, safeSettings } from './storage.js'
import { SpeechController, validateEndpoint, wordAtPoint } from './speech.js'
import { lookup, normalizeWord, importDictionary } from './dictionary.js'
import { icon, iconButton } from './icons.js'
import { fonts, themes, themeById, themeProperties, validateTheme } from './presentation.js'
import { projectFonts, registerFont, unregisterFont, fontLabel, fontCSS } from './font-resources.js'
import { languages, initializeI18n, setUILanguage, currentLanguage, t, translateUI } from './i18n.js'
import { scanDirectory, ensureFolderPermission, readMetadata } from './folders.js'
import { attachImageGestures } from './image-viewer.js'

const $ = selector => document.querySelector(selector)
let userFonts = await allFonts().catch(()=>[])
for (const resource of [...projectFonts,...userFonts]) {
  try { await registerFont(resource); if (!resource.project) fonts.push([resource.id,`"${resource.id}", serif`]) }
  catch { userFonts=userFonts.filter(font=>font.id!==resource.id) }
}
const storedSettings = readJSON('lector-settings', {})
if (!storedSettings.presentationVersion) storedSettings.animated = true
const settings = safeSettings(storedSettings)
settings.presentationVersion = 2
setUILanguage(settings.uiLanguage)
let book, record, selection, apiKey = '', busy = false, saveTimer, loadSequence = 0, searchSequence = 0
let storageWarning = false, focusBeforePanel
let folderSources = [], localBooks = [], libraryLimit = 60, folderScan, libraryCoverURLs = []
let zenHintTimer, narratedRange, themeDraft

const rangeControl = (key, label, min, max, step, unit = '') => `<label class="field range-field"><span>${label}<output for="${key}" data-output="${key}">${settings[key]}${unit}</output></span><input id="${key}" type="range" data-setting="${key}" min="${min}" max="${max}" step="${step}" value="${settings[key]}" data-unit="${unit}"></label>`
const check = (key, label) => `<label class="check-field"><input type="checkbox" data-setting="${key}" ${settings[key] ? 'checked' : ''}>${label}</label>`
const themeButtons = () => [...themes,...settings.customThemes].map(theme => `<button class="theme-option" data-theme="${theme.id}" aria-pressed="${settings.theme === theme.id}"><span class="theme-sample" style="--sample-bg:${theme.colors?.[0] ?? '#edf0e5'};--sample-ink:${theme.colors?.[2] ?? '#637557'}">${icon(theme.icon)}</span><span ${theme.id.startsWith('personal-')?'data-user-content':''}>${escapeHTML(theme.label)}</span></button>`).join('')
const themePicker = `<div class="theme-options" role="group" aria-label="Tema">${themeButtons()}</div>`
const colorLabels = ['Fondo','Paneles','Texto','Texto secundario','Líneas','Acento','Resaltado','Interacción']

$('#app').innerHTML = `
  <header class="toolbar" aria-label="Controles del lector">
    <div class="toolbar-left">${iconButton('index-toggle', 'index', 'Índice y biblioteca', 'aria-expanded="false" aria-controls="sidebar"')}</div>
    <div class="toolbar-reading">
      ${iconButton('open-file', 'open', 'Abrir documento (Ctrl+O)')}
      ${iconButton('audio-toggle', 'play', 'Leer en voz alta', 'disabled')}
      ${iconButton('voice-toggle', 'volume', 'Ajustes de voz', 'aria-expanded="false" aria-controls="voice-panel"')}
    </div>
    <div class="toolbar-right">
      ${iconButton('appearance-toggle', 'type', 'Tipografía y página', 'aria-expanded="false" aria-controls="appearance-panel"')}
      ${iconButton('theme-toggle', 'sun', 'Tema', 'aria-expanded="false" aria-controls="theme-panel"')}
      ${iconButton('zen-toggle', 'zen', 'Modo zen (Z)', 'aria-pressed="false"')}
      ${iconButton('fullscreen-toggle', 'expand', 'Pantalla completa (F)')}
      ${iconButton('preferences-toggle', 'gear', 'Ajustes', 'aria-expanded="false" aria-controls="preferences-panel"')}
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
    <section id="library-tab" role="tabpanel" aria-label="Biblioteca" hidden>
      <div class="library-actions"><button id="add-folder" class="text-button">${icon('open')}Añadir carpeta</button>${iconButton('refresh-folders','auto','Actualizar carpetas')}</div>
      <div id="folder-list"></div>
      <p class="small muted folder-explanation">Los títulos se obtienen de los nombres de carpeta. EPUB, metadatos y portadas se leen solo cuando los eliges.</p>
      <div id="folder-progress" role="status" hidden><span id="folder-progress-text"></span><button id="cancel-scan" class="text-button">Cancelar escaneo</button></div>
      <label class="field"><span class="sr-only">Buscar título o autor</span><input id="library-search" type="search" placeholder="Buscar título o autor"></label>
      <div class="library-controls"><label>Ordenar por<select id="library-sort"><option value="title">Título</option><option value="author">Autor</option><option value="recent">Recientes</option></select></label><label><span class="sr-only">Apariencia</span><select data-setting="libraryView"><option value="list">Título</option><option value="covers">Portadas</option></select></label></div>
      <div id="library-count" class="small muted"></div><div id="library-list"></div>
      <button id="library-more" class="text-button" hidden>Mostrar más</button>
    </section>
  </aside>
  <main id="reading-area" aria-label="Libro"><foliate-view id="reader"></foliate-view></main>
  <footer class="reading-footer" hidden>
    ${iconButton('previous-page', 'left', 'Página anterior (←)')}
    <button id="position-button" class="position-button" title="Ir a una posición del libro"><span id="chapter-name"></span><span class="position-divider">·</span><span id="progress-text">0 %</span></button>
    ${iconButton('next-page', 'right', 'Página siguiente (→)')}
    <div id="progress-line" aria-hidden="true"></div>
  </footer>
  <div class="zen-exit"><button id="zen-exit" class="icon-button" title="Salir del modo zen" aria-label="Salir del modo zen">${icon('zen')}</button></div>
  <div id="zen-hint" class="zen-hint" role="status" hidden><p>Aquí puedes volver a la apariencia anterior. También puedes pulsar Esc.</p><button id="dismiss-zen-hint" class="text-button">Entendido</button></div>
  <aside id="preferences-panel" class="panel" role="dialog" aria-labelledby="preferences-title" hidden>
    <div class="panel-heading"><h2 id="preferences-title">Ajustes</h2><button class="icon-button panel-close" aria-label="Cerrar">${icon('close')}</button></div>
    <details class="settings-section" open><summary>General</summary>
    <label class="field">Idioma de la interfaz<select data-setting="uiLanguage"><option value="auto">Detectar idioma del sistema</option>${Object.entries(languages).map(([code,label])=>`<option value="${code}">${label}</option>`).join('')}</select></label>
    <p class="small muted">El idioma cambia los menús, no el texto del libro.</p>
    <label class="field">Apariencia<select data-setting="appearance"><option value="minimal">Lectura minimalista</option></select></label>
    <p class="small muted">Las próximas apariencias se elegirán aquí.</p>
    </details>
    <details class="settings-section"><summary>Lectura</summary><button class="settings-link" data-settings-panel="appearance">Tipografía y página ${icon('right')}</button></details>
    <details class="settings-section"><summary>Apariencia</summary><button class="settings-link" data-settings-panel="theme">Temas y colores ${icon('right')}</button></details>
    <details class="settings-section"><summary>Voz</summary><button class="settings-link" data-settings-panel="voice">Lectura en voz alta ${icon('right')}</button></details>
    <details class="settings-section"><summary>Biblioteca</summary><button class="settings-link" data-settings-tab="library">Abrir biblioteca ${icon('right')}</button></details>
    <details class="settings-section"><summary>Notas y vocabulario</summary><button class="settings-link" data-settings-tab="notes">Ver notas ${icon('right')}</button></details>
    <details class="settings-section"><summary>Datos</summary><p class="small muted">Los libros y las notas se guardan en este navegador. No se descargan archivos automáticamente.</p></details>
    <details class="settings-section"><summary>Dispositivos</summary><button id="settings-fullscreen" class="settings-link">Pantalla completa ${icon('expand')}</button><button id="settings-zen" class="settings-link">Modo zen ${icon('zen')}</button></details>
  </aside>
  <aside id="appearance-panel" class="panel" role="dialog" aria-labelledby="appearance-title" hidden>
    <div class="panel-heading"><h2 id="appearance-title">Tipografía y página</h2><button class="icon-button panel-close" aria-label="Cerrar">${icon('close')}</button></div>
    <label class="field">Tipografía<select data-setting="font">${fonts.map(([name]) => `<option value="${name}" ${/^(personal|project)-/.test(name)?'data-user-content':''}>${escapeHTML(name === 'system' ? 'Sans del sistema' : fontLabel(name))}</option>`).join('')}</select></label>
    <p class="small muted">Las fuentes no instaladas usan una alternativa similar. Atkinson y Lexend están incluidas.</p>
    <details class="settings-section"><summary>Fuentes personales</summary><label class="text-button font-import">Añadir fuente<input id="font-file" type="file" accept=".woff2,.woff,.ttf,.otf" hidden></label><div id="personal-fonts"></div><p class="small muted">Las fuentes añadidas se guardan en este navegador.</p></details>
    ${rangeControl('fontSize', 'Tamaño', 14, 36, 1, ' px')}
    ${rangeControl('lineHeight', 'Interlineado', 1.2, 2.4, 0.05)}
    ${rangeControl('paragraphGap', 'Espacio entre párrafos', 0, 2, 0.1, ' em')}
    <label class="field">Columnas<select data-setting="columns"><option value="1">Una</option><option value="2">Dos</option><option value="3">Tres</option></select></label>
    ${rangeControl('width', 'Anchura de lectura', 640, 3840, 20, ' px')}
    ${check('fullWidth', 'Usar toda la anchura disponible')}
    ${rangeControl('gutter', 'Separación de columnas', 1, 12, 0.5, ' %')}
    ${rangeControl('marginOuter','Margen exterior',0,160,2,' px')}${rangeControl('marginInner','Margen interior de página',0,100,2,' px')}
    <p class="small muted">Exterior: laterales del visor. Interior: espacio arriba y abajo de cada página.</p>
    ${check('justify', 'Justificar el texto')}${check('animated', 'Transición suave de página')}${check('hyphenate','Separar palabras con guiones')}
    <button id="reset-appearance" class="text-button reset-button">Restablecer presentación</button>
  </aside>
  <aside id="theme-panel" class="panel compact-panel" role="dialog" aria-labelledby="theme-title" hidden>
    <div class="panel-heading"><h2 id="theme-title">Tema</h2><button class="icon-button panel-close" aria-label="Cerrar">${icon('close')}</button></div>
    ${themePicker}<p class="small muted">Automático: mañana de 7 a 18 h, tarde de 18 a 22 h y noche de 22 a 7 h, según la hora del dispositivo.</p>
    <details id="theme-editor" class="settings-section"><summary>Editor de temas</summary>
      <form id="theme-form"><label class="field">Nombre del tema<input id="theme-name" maxlength="48" required></label>
      <div class="color-fields">${colorLabels.map((label,index)=>`<label>${label}<input type="color" data-theme-color="${index}" aria-label="${label}"></label>`).join('')}</div>
      <div class="editor-actions"><button id="theme-new" type="button" class="text-button">Nuevo tema</button><button type="submit" class="text-button">Guardar tema</button><button id="theme-delete" type="button" class="text-button" hidden>Eliminar tema</button></div>
      <p id="theme-message" class="small muted" role="status"></p></form>
      <details class="settings-section"><summary>Importar o copiar tema</summary><button id="theme-copy" class="text-button">Copiar tema</button><label class="field">Tema en JSON<textarea id="theme-json" rows="4" spellcheck="false"></textarea></label><button id="theme-import" class="text-button">Importar tema</button></details>
    </details>
  </aside>
  <aside id="voice-panel" class="panel" role="dialog" aria-labelledby="voice-title" hidden>
    <div class="panel-heading"><h2 id="voice-title">Lectura en voz alta</h2><button class="icon-button panel-close" aria-label="Cerrar">${icon('close')}</button></div>
    <label class="field">Servicio<select data-setting="provider"><option value="browser">Voces del navegador</option><option value="openai">OpenAI / API compatible</option></select></label>
    <label class="field">Idioma del libro<select id="speech-language"><option value="auto">Detectar del libro</option>${Object.entries(languages).map(([code,label])=>`<option value="${code}">${label}</option>`).join('')}</select></label>
    <div id="browser-voice-settings"><label class="field">Voz<select id="browser-voices" data-setting="voice"><option value="">Automática · idioma del libro</option></select></label><p id="voice-availability" class="small muted"></p>${rangeControl('pitch', 'Tono', 0.5, 1.5, 0.1)}</div>
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
    <label class="field">Resaltado<select data-setting="highlightMode"><option value="word">Palabra</option><option value="sentence">Frase</option></select></label>
    ${check('followSpeech', 'Seguir la lectura automáticamente')}${check('clickToRead', 'Continuar desde la palabra pulsada')}
    <p class="small muted">El seguimiento por palabra depende de la voz. Si no informa de las palabras, se sigue por fragmentos de página.</p>
    <div class="voice-actions"><button id="voice-preview" class="text-button">${icon('play')}Probar voz</button><button id="audio-stop" class="text-button">${icon('stop')}Detener</button></div>
  </aside>
  <div id="selection-menu" class="selection-menu" role="toolbar" aria-label="Texto seleccionado" hidden><button id="define-selection">Consultar</button><button id="annotate-selection">Anotar</button><button id="speak-selection">Leer desde aquí</button></div>
  <dialog id="file-dialog" class="file-dialog" aria-label="Abrir documento">
    <form method="dialog" class="dialog-dismiss">${iconButton('dismiss-file', 'close', 'Cerrar selector')}</form>
    <button id="choose-file" class="choose-file">${icon('open')}<span>Abrir un libro</span></button>
    <span class="file-types">EPUB · MOBI · Word · PDF · TXT</span>
    <button id="choose-folder" class="text-button">${icon('open')}Añadir carpeta</button>
    <div id="resume-list" class="resume-list"></div>
    <label class="check-field local-save"><input id="remember-file" type="checkbox" checked>Guardar el archivo en este navegador</label>
    <p id="file-error" class="error small" role="alert" hidden></p>
  </dialog>
  <dialog id="note-dialog" class="small-dialog" aria-labelledby="note-title"><div class="panel-heading"><h2 id="note-title">Nota de lectura</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><blockquote id="note-quote"></blockquote><label class="field">Tu nota<textarea id="note-text" rows="5" placeholder="Escribe una nota…"></textarea></label><button id="save-note" class="primary-button">Guardar nota</button></dialog>
  <dialog id="dictionary-dialog" class="small-dialog" aria-labelledby="dictionary-word"><div class="panel-heading"><h2 id="dictionary-word"></h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><p id="dictionary-definition"></p><a id="dictionary-external" class="text-link" target="_blank" rel="noopener noreferrer">Consultar en Wikcionario ↗</a><label class="text-button dictionary-import">Importar diccionario propio<input id="dictionary-file" type="file" accept=".json" hidden></label><p class="small muted">Glosario local básico y diccionarios JSON propios. Formato: {"palabra": "definición"}.</p></dialog>
  <dialog id="image-dialog" class="image-dialog" aria-label="Imagen ampliada"><div class="image-toolbar">${iconButton('zoom-out', 'minus', 'Reducir imagen')}<output id="zoom-level">100 %</output>${iconButton('zoom-in', 'plus', 'Ampliar imagen')}${iconButton('zoom-fit', 'expand', 'Ajustar imagen')}<button class="icon-button dialog-close" aria-label="Cerrar imagen">${icon('close')}</button></div><div class="image-stage"><img id="zoom-image" alt=""></div></dialog>
  <dialog id="footnote-dialog" class="small-dialog" aria-labelledby="footnote-title"><div class="panel-heading"><h2 id="footnote-title">Nota del libro</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><div id="footnote-content"></div></dialog>
  <dialog id="about-dialog" class="about-dialog" aria-labelledby="about-title">
    <header class="about-header">
      <div class="about-project-icon" aria-hidden="true"><img src="${faviconURL}" alt=""></div>
      <div class="about-heading"><p>Lector · biblioteca personal</p><h2 id="about-title">Leer a tu ritmo</h2></div>
      <button class="icon-button dialog-close" aria-label="Cerrar Acerca de">${icon('close')}</button>
    </header>
    <div class="about-layout">
      <aside class="about-index" aria-label="Ficha del proyecto">
        <h3>Ficha del proyecto</h3>
        <dl>
          <div><dt>Autor</dt><dd>Alejandro Pico</dd></div>
          <div><dt>Carácter</dt><dd>Proyecto personal</dd></div>
          <div><dt>Propósito</dt><dd>Lectura y escucha</dd></div>
          <div><dt>Edición</dt><dd>Versión 0.4</dd></div>
        </dl>
      </aside>
      <div class="about-body">
        <p class="about-lead">Lector es un proyecto independiente pensado para disfrutar de tus libros con calma: un espacio limpio, una presentación adaptable y la posibilidad de alternar entre leer y escuchar.</p>
        <section class="about-purpose" aria-labelledby="about-principles">
          <h3 id="about-principles">Principios del lector</h3>
          <div><strong>Leer</strong><span>Texto protagonista, columnas y tipografía a tu medida, con temas que acompañan cada momento del día.</span></div>
          <div><strong>Escuchar</strong><span>Lectura en voz alta con las voces del navegador y conexión opcional con servicios de voz por API.</span></div>
          <div><strong>Recordar</strong><span>Índice, búsqueda, notas y marcadores para volver a tus ideas y continuar donde lo dejaste.</span></div>
        </section>
        <p class="about-note"><strong>Tu biblioteca.</strong> Los archivos y las notas se guardan en este navegador. Si activas una API de voz, el servicio recibirá los fragmentos narrados y podrá cobrar por su uso. Las voces disponibles dependen del navegador y del sistema.</p>
        <details class="about-shortcuts"><summary>Atajos de lectura</summary><p>← / → pasar página · Z modo zen · F pantalla completa · Espacio leer o pausar · Ctrl+O abrir · Esc cerrar.</p></details>
      </div>
    </div>
    <nav class="about-links" aria-label="Enlaces del proyecto">
      <a href="https://alejandropico.github.io/Portfolio/" target="_blank" rel="noopener noreferrer"><span>01 · Autor</span><strong>Portfolio de Alejandro Pico</strong><b aria-hidden="true">↗</b></a>
      <a href="https://github.com/AlejandroPico/Lector" target="_blank" rel="noopener noreferrer"><span>02 · Proyecto</span><strong>Código y documentación</strong><b aria-hidden="true">↗</b></a>
    </nav>
    <div class="about-spectrum" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
  </dialog>
  <dialog id="position-dialog" class="small-dialog" aria-labelledby="position-title"><div class="panel-heading"><h2 id="position-title">Posición del libro</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><label class="field">Porcentaje de lectura<input id="position-input" type="number" min="0" max="100" step="1"></label><button id="go-position" class="primary-button">Ir</button></dialog>
  <input id="file-input" type="file" accept=".epub,.mobi,.azw3,.docx,.doc,.pdf,.txt,.fb2" hidden>
  <div id="loading" class="loading" role="status" hidden><span class="loading-line"></span><span id="loading-text">Abriendo libro…</span></div>
  <div id="toast" class="toast" role="status" hidden></div>
`
initializeI18n($('#app'), settings.uiLanguage)
$('#speech-language').value = settings.speechLanguage

const view = $('#reader')
const imageViewer = attachImageGestures($('.image-stage'), $('#zoom-image'), { onChange: scale => $('#zoom-level').textContent = `${Math.round(scale * 100)} %` })
let toastTimer
function toast(message, duration = 6000) {
  $('#toast').textContent = t(message); $('#toast').hidden = false
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
    narratedRange = range
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
  const font = fonts.find(([name]) => name === settings.font)?.[1] ?? fonts[0][1]
  const bundledFonts = settings.font === 'Atkinson Hyperlegible' || settings.font === 'Lexend'
    ? [...document.styleSheets].flatMap(sheet => { try { return [...sheet.cssRules].filter(rule => rule.type === CSSRule.FONT_FACE_RULE && rule.style.fontFamily.replace(/["']/g,'') === settings.font).map(rule => rule.cssText.replace(/url\(["']?([^"')]+)["']?\)/g, (_,url) => `url("${new URL(url, sheet.href || document.baseURI).href}")`)) } catch { return [] } }).join('\n') : ''
  return `${bundledFonts}\n${fontCSS(settings.font)}\nhtml { --theme-bg-color: ${colors.bg}; color: ${colors.ink} !important; background: ${colors.bg} !important; color-scheme: ${document.documentElement.style.colorScheme}; border: 0 !important; outline: 0 !important; box-shadow: none !important; }
    body { font-family: ${font} !important; font-size: ${settings.fontSize}px !important; line-height: ${settings.lineHeight} !important; color: ${colors.ink} !important; background: transparent !important; text-align: ${settings.justify ? 'justify' : 'left'} !important; overflow-wrap: break-word; }
    p, div, li, blockquote { font-family: inherit !important; font-size: inherit !important; line-height: inherit !important; color: inherit !important; }
    p { margin-block: 0 ${settings.paragraphGap}em !important; }
    body,p,div,li,blockquote { hyphens: ${settings.hyphenate?'auto':'none'} !important; }
    body, main, article, section, div { border: 0 !important; outline: 0 !important; box-shadow: none !important; }
    body.reader-cover { display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; min-height: 75vh !important; text-align: center !important; }
    body.reader-cover img, body.reader-cover svg { display: block; margin: auto !important; max-height: 72vh !important; max-width: 100% !important; width: min(100%, 55vh) !important; height: auto !important; }
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
  const theme = themeDraft ?? themeById(effectiveTheme(settings.theme),settings.customThemes)
  document.documentElement.dataset.theme = theme.id
  theme.colors.forEach((value,index) => document.documentElement.style.setProperty(`--${themeProperties[index]}`,value))
  document.documentElement.style.colorScheme = theme.dark ? 'dark' : 'light'
  $('#theme-toggle').innerHTML = icon(theme.icon)
  $('#reading-area').style.maxWidth = settings.fullWidth ? 'none' : `${settings.width}px`
  const outer = Math.min(settings.marginOuter,innerWidth<700?48:160)
  $('#reading-area').style.paddingInline = `${outer}px`
  $('#width').disabled = settings.fullWidth
  if (view.renderer) {
    const count = window.innerWidth < 700 ? 1 : settings.columns
    view.renderer.setAttribute('max-column-count', count)
    view.renderer.setAttribute('max-inline-size', `${Math.max(220, ($('#reading-area').clientWidth - outer*2) / count)}px`)
    view.renderer.setAttribute('gap', `${settings.gutter}%`)
    view.renderer.setAttribute('margin', `${Math.min(settings.marginInner,innerWidth<700?48:100)}px`)
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
  speech.onHighlight(narratedRange)
  writeJSON('lector-settings', settings)
}

function closePanels() {
  if (themeDraft) { themeDraft=undefined; applySettings() }
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
  clearTimeout(zenHintTimer)
  if (active) {
    closePanels(); sidebar(false)
    if (!readJSON('lector-zen-help-seen', false)) {
      $('#zen-hint').hidden = false; document.body.classList.add('zen-help')
      writeJSON('lector-zen-help-seen', true)
      zenHintTimer = setTimeout(dismissZenHint, 15000)
    }
  } else dismissZenHint()
}
function dismissZenHint() { $('#zen-hint').hidden = true; document.body.classList.remove('zen-help'); clearTimeout(zenHintTimer) }

function syncVoices() {
  const voices = globalThis.speechSynthesis?.getVoices() ?? []
  const language = settings.language.split('-')[0]
  voices.sort((a, b) => (b.lang.startsWith(language) - a.lang.startsWith(language)) || a.name.localeCompare(b.name))
  $('#browser-voices').innerHTML = `<option value="">${t('Automática · idioma del libro')}</option>` + voices.map(voice => `<option value="${escapeHTML(voice.voiceURI)}">${escapeHTML(voice.name)} · ${escapeHTML(voice.lang)}</option>`).join('')
  $('#browser-voices').value = settings.voice
  $('#voice-availability').textContent = voices.length ? `${voices.length} ${t('voces disponibles')}. ${t('Las voces de red pueden necesitar conexión.')}` : t('El navegador todavía no ha cargado sus voces. Si no aparecen, prueba otro navegador o revisa las voces instaladas en el sistema.')
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
  localBooks = await allBooks()
  folderSources = await allFolders()
  const books = localBooks
  const available = books.filter(item => item.file || item.fileHandle)
  $('#resume-list').replaceChildren()
  available.slice(0, 3).forEach(item => {
    const button = document.createElement('button'); button.className = 'resume-button'
    const label = document.createElement('span'); label.textContent = item.title
    const percent = document.createElement('span'); percent.className = 'muted small'; percent.textContent = `${Math.round((Number.isFinite(item.fraction) ? item.fraction : 0) * 100)} %`
    button.append(label, percent); button.addEventListener('click', attempt(() => openStored(item.id)))
    $('#resume-list').append(button)
  })
  renderFolders(); renderLibrary()
}

function renderFolders() {
  $('#folder-list').replaceChildren()
  for (const folder of folderSources) {
    const row = document.createElement('div'); row.className = 'folder-row'
    const label = document.createElement('span'); label.dataset.userContent = ''; label.textContent = `${folder.name} · ${folder.entries.length}`
    const remove = document.createElement('button'); remove.className = 'icon-button'; remove.innerHTML = icon('close'); remove.title = t('Desvincular carpeta'); remove.setAttribute('aria-label',t('Desvincular carpeta'))
    remove.onclick = attempt(async () => { await removeFolder(folder.id); await updateLibrary() })
    row.append(label,remove); $('#folder-list').append(row)
  }
}

function renderLibrary() {
  for (const url of libraryCoverURLs) URL.revokeObjectURL(url)
  libraryCoverURLs = []
  const query = $('#library-search').value.trim().toLocaleLowerCase(currentLanguage())
  const linked = folderSources.flatMap(folder => folder.entries.map(entry => ({ ...entry, folder, kind: 'folder', id: `${folder.id}:${entry.key}` })))
  const entries = [...localBooks.filter(item => !item.folderId || !folderSources.some(folder => folder.id === item.folderId)).map(item => ({ ...item, kind: 'local' })), ...linked]
  const filtered = entries.filter(item => `${item.title} ${item.author ?? ''}`.toLocaleLowerCase(currentLanguage()).includes(query))
  const sort = $('#library-sort').value
  const collator = new Intl.Collator(currentLanguage(), { numeric: true, sensitivity: 'base' })
  filtered.sort((a,b) => sort === 'recent' ? (b.updatedAt ?? 0) - (a.updatedAt ?? 0) || collator.compare(a.title,b.title)
    : collator.compare(sort === 'author' ? a.author ?? '' : a.title, sort === 'author' ? b.author ?? '' : b.title))
  $('#library-count').textContent = `${filtered.length.toLocaleString(currentLanguage())} ${t('libros')}`
  const list = $('#library-list'); list.replaceChildren(); list.classList.toggle('cover-grid', settings.libraryView === 'covers')
  if (!filtered.length) { const empty = document.createElement('p'); empty.className = 'small muted'; empty.textContent = t(query ? 'No hay resultados.' : 'Los libros que abras aparecerán aquí.'); list.append(empty) }
  for (const item of filtered.slice(0,libraryLimit)) {
    const row = document.createElement('div'); row.className = 'library-row'
    if (settings.libraryView === 'covers') {
      const cover = document.createElement('button'); cover.className = 'catalog-cover'; cover.title = t('Cargar portada'); cover.setAttribute('aria-label',t('Cargar portada'))
      if (item.coverBlob) {
        const image = document.createElement('img'); const url = URL.createObjectURL(item.coverBlob); libraryCoverURLs.push(url)
        image.src = url; image.alt = item.title; cover.append(image)
      } else cover.innerHTML = icon('book')
      cover.onclick = attempt(async () => {
        if (item.coverBlob) { const url = URL.createObjectURL(item.coverBlob); showImage(url,item.title); $('#image-dialog').addEventListener('close',()=>URL.revokeObjectURL(url),{once:true}); return }
        if (item.kind !== 'folder') { await openStored(item.id); $('#show-cover').click(); return }
        if (!item.cover) { await openFolderEntry(item.folder,item); $('#show-cover').click(); return }
        await ensureFolderPermission(item.folder.handle)
        const file = await item.cover.getFile()
        if (file.size > 12 * 1024 * 1024) throw new Error('La portada supera el límite de 12 MB.')
        const original = item.folder.entries.find(entry=>entry.key===item.key); original.coverBlob = file
        await saveFolder(item.folder); renderLibrary()
      })
      row.append(cover)
    }
    const content = document.createElement('div'); content.className = 'library-entry'
    const button = document.createElement('button'); button.className = 'library-book'; button.dataset.userContent = ''; button.textContent = item.title
    button.onclick = attempt(async () => {
      if (item.kind === 'folder') await openFolderEntry(item.folder,item)
      else if (item.file || item.fileHandle) await openStored(item.id)
      else { toast('Vuelve a elegir el archivo para recuperar sus notas y su posición.'); $('#file-input').click() }
    })
    content.append(button)
    if (item.author) { const author = document.createElement('span'); author.className = 'small muted'; author.dataset.userContent=''; author.textContent = item.author; content.append(author) }
    if (item.kind === 'folder') {
      const formats = document.createElement('div'); formats.className = 'catalog-formats'
      for (const format of item.formats) {
        const formatButton = document.createElement('button'); formatButton.textContent = format.extension.toUpperCase(); formatButton.onclick = attempt(()=>openFolderEntry(item.folder,item,format)); formats.append(formatButton)
      }
      content.append(formats)
      if (item.metadata) {
        const metadata = document.createElement('button'); metadata.className = 'text-button metadata-button'; metadata.textContent = t('Leer metadatos')
        metadata.onclick = attempt(async () => {
          await ensureFolderPermission(item.folder.handle)
          const data = await readMetadata(item)
          Object.assign(item.folder.entries.find(entry=>entry.key===item.key),data,{opfLoaded:true})
          await saveFolder(item.folder); renderLibrary(); toast('Metadatos cargados')
        }); content.append(metadata)
      }
    }
    row.append(content)
    if (item.kind === 'local') {
      const remove = document.createElement('button'); remove.className = 'icon-button'; remove.innerHTML = icon('trash'); remove.title = t('Quitar de la biblioteca'); remove.setAttribute('aria-label',t('Quitar de la biblioteca'))
      remove.onclick = attempt(async () => {
        if (item.notes?.length && !confirm(`${t('Quitar de la biblioteca')}: «${item.title}» (${item.notes.length})?`)) return
        if (record?.id === item.id) { clearTimeout(saveTimer); speech.stop(); view.close(); book?.destroy?.(); book = null; record = null; $('#audio-toggle').disabled = true; $('.reading-footer').hidden = true }
        await removeBook(item.id); await updateLibrary()
      }); row.append(remove)
    }
    list.append(row)
  }
  $('#library-more').hidden = filtered.length <= libraryLimit
}

async function openFolderEntry(folder, entry, format = entry.formats[0]) {
  if (busy) return
  await ensureFolderPermission(folder.handle)
  const file = await format.handle.getFile()
  if (file.size > 100 * 1024 * 1024) throw new Error('El límite de esta versión es de 100 MB por archivo.')
  const id = await fileId(file)
  const previous = await getBook(id)
  await openFile(file, { ...previous, id, folderId: folder.id, entryKey: entry.key, fileHandle: format.handle, author: entry.author, catalogTitle: entry.opfLoaded ? entry.title : undefined })
  if (record?.id === id) {
    const original = folder.entries.find(item=>item.key===entry.key)
    original.updatedAt = Date.now(); await saveFolder(folder); await updateLibrary()
  }
  if (innerWidth < 900) sidebar(false)
}

async function indexFolder(folder) {
  if (folderScan) return
  folderScan = new AbortController(); $('#folder-progress').hidden = false
  try {
    await ensureFolderPermission(folder.handle)
    const prior = new Map(folder.entries?.map(entry=>[entry.key,entry]) ?? [])
    const entries = await scanDirectory(folder.handle, { signal: folderScan.signal, onProgress: progress => {
      $('#folder-progress-text').textContent = `${t('Indexando carpetas…')} ${progress.books.toLocaleString(currentLanguage())} ${t('libros')}`
    } })
    folder.entries = entries.map(entry => ({ ...entry, ...(prior.has(entry.key) ? { coverBlob: prior.get(entry.key).coverBlob, title: prior.get(entry.key).title, author: prior.get(entry.key).author, language: prior.get(entry.key).language, opfLoaded: prior.get(entry.key).opfLoaded, updatedAt: prior.get(entry.key).updatedAt } : {}) }))
    folder.updatedAt = Date.now(); await saveFolder(folder); await updateLibrary()
  } finally { folderScan = null; $('#folder-progress').hidden = true }
}

async function connectFolder() {
  if (folderScan) return
  if (!window.showDirectoryPicker) { toast('Para abrir carpetas sin leer todos sus archivos utiliza Chrome o Edge en HTTPS o localhost.', 12000); return }
  try {
    const handle = await window.showDirectoryPicker({ id: 'lector-library', mode: 'read' })
    const sources = await allFolders()
    let folder
    for (const source of sources) if (await handle.isSameEntry(source.handle)) { folder = source; break }
    folder ??= { id: crypto.randomUUID(), handle, name: handle.name, entries: [] }
    $('#file-dialog').close(); sidebar(true); $('[data-tab="library"]').click()
    await indexFolder(folder)
  } catch (error) { if (error.name !== 'AbortError') handleError(error) }
}

async function openStored(id) {
  const saved = await getBook(id)
  if (!saved?.file && !saved?.fileHandle) throw new Error('No se encuentra el archivo guardado. Vuelve a abrirlo.')
  if (saved.fileHandle) await ensureFolderPermission(saved.fileHandle)
  const file = saved.fileHandle ? await saved.fileHandle.getFile() : new File([saved.file], saved.filename, { type: saved.file.type })
  await openFile(file, saved)
}

async function openFile(file, saved) {
  if (busy) return
  busy = true; const sequence = ++loadSequence
  $('#file-error').hidden = true; closePanels(); speech.stop()
  $('#loading').hidden = false; $('#loading-text').textContent = 'Abriendo libro…'
  let imported
  try {
    if (file.size > 100 * 1024 * 1024) throw new Error('El límite de esta versión es de 100 MB por archivo.')
    const id = saved?.id ?? await fileId(file)
    ++searchSequence
    imported = await importBook(file, text => $('#loading-text').textContent = text)
    saved ??= await getBook(id).catch(() => null)
    const title = saved?.catalogTitle || metadataText(imported.metadata?.title) || file.name
    const nextRecord = { id, title, filename: file.name, file: saved?.fileHandle ? undefined : $('#remember-file').checked ? file : undefined,
      fileHandle: saved?.fileHandle, folderId: saved?.folderId, entryKey: saved?.entryKey, catalogTitle: saved?.catalogTitle, author: saved?.author ?? metadataText(imported.metadata?.author), coverBlob: saved?.coverBlob,
      notes: saved?.notes ?? [], cfi: saved?.cfi, fraction: Number.isFinite(saved?.fraction) ? saved.fraction : 0, updatedAt: Date.now() }
    clearTimeout(saveTimer)
    view.close(); book?.destroy?.(); book = null; record = null
    await view.open(imported)
    book = imported; record = nextRecord
    if ($('#speech-language').value === 'auto') {
      settings.language = metadataText(book.metadata?.language) || currentLanguage()
      syncVoices()
    }
    applySettings()
    await view.init({ lastLocation: nextRecord.cfi, showTextStart: !nextRecord.cfi })
    if (!view.renderer.getContents().length) throw new Error('No se pudo mostrar el primer capítulo del documento.')
    if (sequence !== loadSequence) return
    $('#book-title').dataset.userContent = ''; $('#book-title').textContent = title
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
  record.cfi = detail.cfi; record.fraction = Number.isFinite(detail.fraction) ? detail.fraction : record.fraction
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
  doc.documentElement.lang ||= metadataText(book?.metadata?.language) || currentLanguage()
  if (doc.querySelector('img,svg') && (/cover|portada|cubierta/i.test(String(book?.sections[index]?.id ?? '')) || doc.body.textContent.trim().length < 60)) doc.body.classList.add('reader-cover')
  doc.querySelectorAll('[data-no-speech]').forEach(el => { if (!el.querySelector('button')) el.textContent = t(el.textContent.trim()) })
  doc.querySelectorAll('.pdf-original').forEach(button => button.textContent = t('Ver página original'))
  doc.addEventListener('keydown', onKey)
  let press
  doc.addEventListener('pointerdown', event => { press={x:event.clientX,y:event.clientY}; closePanels(); $('#selection-menu').hidden = true })
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
      return
    }
    if (!settings.clickToRead || !['playing','paused'].includes(speech.state) || event.target.closest('a,button,input')
      || doc.defaultView.getSelection()?.toString().trim() || !press || Math.hypot(event.clientX-press.x,event.clientY-press.y)>6) return
    const word = wordAtPoint(doc,event.clientX,event.clientY,settings.language)
    if (word) { event.preventDefault(); await speech.restart(word) }
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
  imageViewer.fit()
}

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
for (const name of ['appearance', 'theme', 'voice', 'preferences']) $(`#${name}-toggle`).onclick = () => togglePanel(name)
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
    if (input.dataset.setting === 'uiLanguage') {
      setUILanguage(settings.uiLanguage)
      renderLibrary(); syncVoices()
    }
    if (input.dataset.setting === 'libraryView') renderLibrary()
    Object.assign(settings, safeSettings(settings)); applySettings()
  })
})
$('#api-key').oninput = event => { speech.stop(); apiKey = event.target.value.trim() }
document.querySelectorAll('[data-settings-panel]').forEach(button=>button.onclick=()=>togglePanel(button.dataset.settingsPanel))
document.querySelectorAll('[data-settings-tab]').forEach(button=>button.onclick=()=>{
  closePanels(); sidebar(true); document.querySelector(`[data-tab="${button.dataset.settingsTab}"]`).click()
})
$('#settings-fullscreen').onclick=()=>$('#fullscreen-toggle').click()
$('#settings-zen').onclick=()=>$('#zen-toggle').click()

function fillThemeEditor(forceNew=false) {
  const theme=themeById(effectiveTheme(settings.theme),settings.customThemes)
  const existing=!forceNew && theme.id.startsWith('personal-')
  $('#theme-form').dataset.themeId=existing?theme.id:''
  $('#theme-name').value=existing?theme.label:t('Mi tema')
  theme.colors.forEach((color,index)=>document.querySelector(`[data-theme-color="${index}"]`).value=color)
  $('#theme-delete').hidden=!existing; $('#theme-message').textContent=''
}
function readThemeEditor() {
  return validateTheme({id:$('#theme-form').dataset.themeId,label:$('#theme-name').value,
    colors:[...document.querySelectorAll('[data-theme-color]')].map(input=>input.value)},true)
}
function savePersonalTheme(theme) {
  const index=settings.customThemes.findIndex(item=>item.id===theme.id)
  if(index<0 && settings.customThemes.length>=30) throw new Error(t('Puedes guardar hasta 30 temas personales.'))
  if(index<0) settings.customThemes.push(theme); else settings.customThemes[index]=theme
  themeDraft=undefined; settings.theme=theme.id
  $('.theme-options').innerHTML=themeButtons(); fillThemeEditor(); applySettings(); translateUI()
  $('#theme-message').textContent=t('Tema guardado')
}
$('#theme-editor').addEventListener('toggle',()=>{
  if($('#theme-editor').open) fillThemeEditor()
  else if(themeDraft) {themeDraft=undefined;applySettings()}
})
$('#theme-form').addEventListener('input',()=>{
  try { themeDraft=readThemeEditor(); applySettings() } catch { /* Keep last valid preview until named. */ }
})
$('#theme-form').onsubmit=attempt(async event=>{event.preventDefault();savePersonalTheme(readThemeEditor())})
$('#theme-new').onclick=()=>{themeDraft=undefined;fillThemeEditor(true);applySettings();$('#theme-name').focus()}
$('#theme-delete').onclick=()=>{
  settings.customThemes=settings.customThemes.filter(theme=>theme.id!==$('#theme-form').dataset.themeId)
  themeDraft=undefined;settings.theme='auto';$('.theme-options').innerHTML=themeButtons();fillThemeEditor();applySettings();translateUI()
}
$('#theme-copy').onclick=attempt(async()=>{
  const json=JSON.stringify(readThemeEditor(),null,2);$('#theme-json').value=json
  try { await navigator.clipboard.writeText(json);toast('Tema copiado') } catch { $('#theme-json').focus();$('#theme-json').select() }
})
$('#theme-import').onclick=attempt(async()=>{
  let input;try {input=JSON.parse($('#theme-json').value)}catch{throw new Error(t('El tema JSON no es válido.'))}
  savePersonalTheme(validateTheme(input));$('#theme-json').value=''
})

function renderPersonalFonts() {
  const select=document.querySelector('[data-setting="font"]')
  select.replaceChildren(...fonts.map(([id])=>{
    const option=document.createElement('option');option.value=id;option.textContent=id==='system'?'Sans del sistema':fontLabel(id)
    if(/^(personal|project)-/.test(id)) option.dataset.userContent=''
    return option
  }))
  const list=$('#personal-fonts');list.replaceChildren()
  for(const font of userFonts) {
    const row=document.createElement('div');row.className='personal-font-row'
    const label=document.createElement('span');label.dataset.userContent='';label.textContent=font.label
    const remove=document.createElement('button');remove.className='icon-button';remove.innerHTML=icon('trash');remove.setAttribute('aria-label',t('Eliminar fuente'))
    remove.onclick=attempt(async()=>{
      await removeFont(font.id);userFonts=userFonts.filter(item=>item.id!==font.id)
      fonts.splice(fonts.findIndex(([id])=>id===font.id),1)
      if(settings.font===font.id) settings.font='Georgia'
      unregisterFont(font.id);renderPersonalFonts();applySettings();translateUI()
    });row.append(label,remove);list.append(row)
  }
}
$('#font-file').onchange=attempt(async()=>{
  const file=$('#font-file').files[0];$('#font-file').value=''
  if(!file) return
  if(!/\.(woff2?|ttf|otf)$/i.test(file.name) || file.size>10*1024*1024) throw new Error(t('Elige una fuente válida de hasta 10 MB.'))
  const font={id:`personal-font-${crypto.randomUUID()}`,label:file.name.replace(/\.(woff2?|ttf|otf)$/i,'').slice(0,80),file}
  try {await registerFont(font)}catch{throw new Error(t('No se pudo cargar la fuente.'))}
  try {await saveFont(font)}catch(error){unregisterFont(font.id);throw error}
  userFonts.push(font);fonts.push([font.id,`"${font.id}", serif`]);settings.font=font.id
  renderPersonalFonts();applySettings();translateUI();toast('Fuente añadida')
})
renderPersonalFonts()
$('#theme-panel').addEventListener('click',event=>{
  const button=event.target.closest('button[data-theme]')
  if (!button) return
  themeDraft=undefined; settings.theme=button.dataset.theme; fillThemeEditor(); applySettings()
})
$('#reset-appearance').onclick = () => { for (const key of ['font', 'fontSize', 'lineHeight', 'paragraphGap', 'columns', 'width', 'gutter', 'fullWidth', 'justify', 'animated','marginOuter','marginInner','hyphenate']) settings[key] = defaults[key]; applySettings() }
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
  if (record) { record.coverBlob = cover; saveRecord(); await updateLibrary() }
  const url = URL.createObjectURL(cover)
  showImage(url, `Portada de ${record.title}`)
  $('#image-dialog').addEventListener('close', () => URL.revokeObjectURL(url), { once: true })
})
$('#define-selection').onclick = () => {
  const word = normalizeWord(selection.quote)
  $('#dictionary-word').textContent = word
  $('#dictionary-definition').textContent = lookup(word) || t('Esta palabra no está en el glosario local. Puedes consultarla en Wikcionario o importar un diccionario propio.')
  const dictionaryLanguage = metadataText(book?.metadata?.language).split('-')[0] || currentLanguage()
  $('#dictionary-external').href = `https://${Object.hasOwn(languages,dictionaryLanguage) ? dictionaryLanguage : 'es'}.wiktionary.org/wiki/${encodeURIComponent(word)}`
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
  speech.stop(); await view.select(selection.cfi); $('#selection-menu').hidden = true; await speech.restart(selection.range)
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
$('#zoom-in').onclick = () => imageViewer.step(.25)
$('#zoom-out').onclick = () => imageViewer.step(-.25)
$('#zoom-fit').onclick = fitImage
$('#image-dialog').addEventListener('close', () => { $('#zoom-image').removeAttribute('src') })
$('#dismiss-zen-hint').onclick = dismissZenHint
$('#choose-folder').onclick = connectFolder
$('#add-folder').onclick = connectFolder
$('#cancel-scan').onclick = () => folderScan?.abort()
$('#refresh-folders').onclick = attempt(async () => {
  for (const folder of folderSources) {
    try { await indexFolder(folder) } catch (error) { if (error.name === 'AbortError') break; throw error }
  }
})
$('#library-search').oninput = () => { libraryLimit = 60; renderLibrary() }
$('#library-sort').onchange = () => { libraryLimit = 60; renderLibrary() }
$('#library-more').onclick = () => { libraryLimit += 60; renderLibrary() }
$('#speech-language').onchange = () => {
  speech.stop()
  settings.speechLanguage = $('#speech-language').value
  settings.language = $('#speech-language').value === 'auto' ? metadataText(book?.metadata?.language) || currentLanguage() : $('#speech-language').value
  syncVoices(); applySettings()
}
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
  status.textContent = count ? `${count}${count >= 100 ? '+' : ''} ${t('resultados')}` : t('No se encontraron coincidencias.')
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
applySettings(); syncVoices(); translateUI()
updateLibrary().catch(() => toast('El almacenamiento local no está disponible. Puedes abrir un libro, pero no se guardará al cerrar.'))
$('#file-dialog').showModal()
