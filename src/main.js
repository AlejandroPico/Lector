import './style.css'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import '@fontsource/lexend/400.css'
import '@fontsource/lexend/600.css'
import faviconURL from '../favicon.svg?url'
import 'foliate-js/view.js'
import './reader-lifecycle.js'
import { Overlayer } from 'foliate-js/overlayer.js'
import { importBook, escapeHTML, metadataText, pdfPageImage } from './books.js'
import { allBooks, allFolders, saveFolder, removeFolder, allFonts, saveFont, removeFont, fileId, getBook, saveBook, removeBook, defaults, readJSON, writeJSON, effectiveTheme, safeSettings } from './storage.js'
import { SpeechController, validateEndpoint, wordAtPoint } from './speech.js'
import { icon, iconButton } from './icons.js'
import { fonts, themes, themeById, themeProperties, validateTheme } from './presentation.js'
import { projectFonts, registerFont, unregisterFont, fontLabel, fontCSS } from './font-resources.js'
import { languages, initializeI18n, setUILanguage, currentLanguage, t, translateUI } from './i18n.js'
import { scanDirectory, ensureFolderPermission, readMetadata } from './folders.js'
import { attachImageGestures } from './image-viewer.js'
import { NavigationTrail,readingMetrics,estimateRemaining } from './reading.js'
import { moveFocus,attachGamepad } from './tv-controls.js'
import { allCatalog,updateCatalog,removeCatalog,allCollections,saveCollection,removeCollection } from './storage.js'
import { statuses,catalogKey,catalogMetadata,libraryEntries,filterLibrary,duplicateGroups,labels,normalize,languageCode } from './library.js'
import { reconcileCatalog } from './catalog-refresh.js'
import { VisibleCoverQueue } from './cover-queue.js'
import { annotationColors,annotationColor,citation,notebookEntries,notesMarkdown,notesHTML } from './notes.js'
import { lookupOffline,installDictionary,importOfflineDictionary,uninstallDictionary,clearDictionaryCache } from './offline-dictionaries.js'
import { normalizeTerm } from './dictionary-core.js'
import { allDictionaryPacks,allVocabulary,saveVocabulary,removeVocabulary } from './storage.js'
import { organizeMenus } from './menu-layout.js'
import { recentReadingOrder } from './library.js'

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
let openingCoverURL
let navigationTrail=new NavigationTrail(),preservingAnchor=false,wheelTurning=false
let layoutSequence=0
let chapterStarts=[]
const metricsCache=new WeakMap()
let catalogRecords=[],collections=[],catalogItems=[],duplicateClusters=[],duplicateIDs=new Set(),duplicateFocus,organizingItem,metadataBatch
let shownLibrary=[],lastSpeechSave=0
let coverQueuePaused=false
let editingNote,notebookBooks=[],notebookShown=[],notebookLimit=100,exportEntries=[]
let dictionaryInstall,dictionaryResult,dictionaryQuerySequence=0,vocabularyLimit=100
let projectDictionaries=[],personalProjectDictionaries=[],dictionaryResourcesPromise

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
    <section id="notes-tab" role="tabpanel" aria-label="Notas" hidden><div class="notes-actions"><button id="add-bookmark" class="text-button">${icon('bookmark')}Marcar página</button><button id="open-notebook" class="icon-button" aria-label="Cuaderno de notas" title="Cuaderno de notas">${icon('note')}</button><button id="export-notes" class="icon-button" aria-label="Exportar notas" title="Exportar notas">${icon('download')}</button></div><div id="notes-list"></div></section>
    <section id="library-tab" role="tabpanel" aria-label="Biblioteca" hidden>
      <div class="library-heading"><span>Biblioteca</span>${iconButton('library-expand','expand','Abrir biblioteca ampliada')}</div>
      <div id="library-content">
      <div class="library-actions"><button id="add-folder" class="text-button">${icon('open')}Añadir carpeta</button>${iconButton('refresh-folders','auto','Actualizar carpetas')}</div>
      <div id="folder-list"></div>
      <p class="small muted folder-explanation">Los títulos se obtienen de los nombres de carpeta. EPUB, metadatos y portadas se leen solo cuando los eliges.</p>
      <div id="folder-progress" role="status" hidden><span id="folder-progress-text"></span><button id="cancel-scan" class="text-button">Cancelar escaneo</button></div>
      <p id="folder-summary" class="small muted" hidden></p>
      <div id="cover-progress" class="small muted" hidden><span id="cover-progress-text"></span><button id="pause-covers" class="text-button">Detener portadas</button><button id="resume-covers" class="text-button" hidden>Continuar portadas</button></div>
      <label class="field"><span class="sr-only">Buscar título o autor</span><input id="library-search" type="search" placeholder="Buscar título o autor"></label>
      <div class="library-controls"><label>Ordenar por<select id="library-sort"><option value="title">Título</option><option value="author">Autor</option><option value="recent">Recientes</option><option value="series">Serie y número</option></select></label><div class="library-view-switch" role="group" aria-label="Vista de biblioteca"><button id="library-view-list" data-library-view="list" aria-label="Mostrar títulos" title="Mostrar títulos">${icon('list')}</button><button id="library-view-covers" data-library-view="covers" aria-label="Mostrar portadas" title="Mostrar portadas">${icon('grid')}</button></div></div>
      <details id="library-filters" class="settings-section"><summary>Filtros y colecciones</summary><div class="filter-grid">
        ${[['author','Autor'],['series','Serie'],['genre','Género'],['tag','Etiqueta'],['language','Idioma'],['format','Formato'],['status','Estado'],['collection','Colección']].map(([key,label])=>`<label class="field">${label}<select id="filter-${key}" data-library-filter="${key}"><option value="">Todos</option></select></label>`).join('')}
      </div><label class="check-field"><input id="filter-duplicates" type="checkbox">Solo posibles duplicados</label><div class="editor-actions"><button id="clear-library-filters" class="text-button">Limpiar filtros</button><button id="show-duplicates" class="text-button">Revisar duplicados</button></div>
      <div class="collection-create"><label class="sr-only" for="collection-name">Nueva colección</label><input id="collection-name" maxlength="80" placeholder="Nueva colección"><button id="collection-create" class="icon-button" aria-label="Crear colección">${icon('plus')}</button><button id="collection-delete" class="icon-button" aria-label="Eliminar colección" hidden>${icon('trash')}</button></div>
      <button id="read-visible-metadata" class="text-button">Leer metadatos mostrados</button><p class="small muted">Los filtros usan metadatos ya cargados. Esta acción lee los metadata.opf de los libros mostrados; en la nube puede descargarlos.</p>
      <div id="metadata-progress" role="status" hidden><span id="metadata-progress-text"></span><button id="metadata-cancel" class="text-button">Cancelar carga</button></div></details>
      <div id="library-count" class="small muted"></div><div id="library-list"></div>
      <button id="library-more" class="text-button" hidden>Mostrar más</button>
      </div>
    </section>
  </aside>
  <main id="reading-area" aria-label="Libro"><foliate-view id="reader" tabindex="0"></foliate-view><section id="opening-cover" class="opening-cover" aria-label="Cubierta" hidden><button id="opening-cover-zoom" class="opening-cover-image" aria-label="Ampliar cubierta"><img id="opening-cover-image" alt=""></button><button id="start-reading" class="text-button">Empezar a leer ${icon('right')}</button></section></main>
  <footer class="reading-footer" hidden>
    ${iconButton('history-back','undo','Volver al lugar anterior (Alt+←)','hidden')}
    ${iconButton('previous-page', 'left', 'Página anterior (←)')}
    <button id="position-button" class="position-button" title="Ir a una posición del libro"><span id="chapter-name"></span><span class="position-divider">·</span><span id="progress-text">0 %</span></button>
    ${iconButton('next-page', 'right', 'Página siguiente (→)')}
    ${iconButton('history-forward','redo','Volver al lugar siguiente (Alt+→)','hidden')}
    <div id="reading-information" class="reading-information" hidden><span id="stable-reference" hidden></span><span id="remaining-times" hidden></span></div>
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
    <details class="settings-section"><summary>Lectura</summary><button class="settings-link" data-settings-panel="appearance">Tipografía y página ${icon('right')}</button>
    <label class="field">Modo de lectura<select data-setting="readingFlow"><option value="paginated">Páginas</option><option value="scrolled">Desplazamiento vertical</option></select></label>
    ${check('historyControls','Mostrar controles de retorno')}${check('showReference','Mostrar ubicación estable')}${check('showChapterTime','Mostrar tiempo restante del capítulo')}${check('showBookTime','Mostrar tiempo restante del libro')}
    <details class="settings-section"><summary>Estimación de tiempo</summary><label class="field">Calcular para<select data-setting="estimateMode"><option value="reading">Lectura visual</option><option value="audio">Narración</option></select></label>${rangeControl('visualWpm','Ritmo de lectura',80,600,10,' palabras/min')}${rangeControl('narrationWpm','Ritmo base de narración',80,300,10,' palabras/min')}
    <p class="small muted">Los tiempos son aproximados. La narración tiene en cuenta la velocidad de voz; los capítulos sin abrir se estiman por su tamaño.</p></details></details>
    <details class="settings-section"><summary>Apariencia</summary><button class="settings-link" data-settings-panel="theme">Temas y colores ${icon('right')}</button>${check('showOpeningCover','Mostrar cubierta al abrir un libro')}</details>
    <details class="settings-section"><summary>Voz</summary><button class="settings-link" data-settings-panel="voice">Lectura en voz alta ${icon('right')}</button></details>
    <details class="settings-section"><summary>Biblioteca</summary><button class="settings-link" data-settings-tab="library">Abrir biblioteca ${icon('right')}</button>${check('libraryDetails','Mostrar detalles de biblioteca')}${check('preloadCovers','Cargar portadas visibles')}${check('preloadEmbeddedCovers','Obtener portadas incrustadas automáticamente')}<p class="small muted">La carga anticipada puede descargar cubiertas de la nube. Obtener una cubierta incrustada también lee el ebook visible.</p></details>
    <details class="settings-section"><summary>Notas y vocabulario</summary><button class="settings-link" data-settings-tab="notes">Ver notas ${icon('right')}</button><button id="settings-notebook" class="settings-link">Cuaderno de notas ${icon('right')}</button>${check('showAnnotations','Mostrar subrayados')}<button id="settings-dictionaries" class="settings-link">Diccionarios sin conexión ${icon('right')}</button><button id="settings-vocabulary" class="settings-link">Vocabulario personal ${icon('right')}</button><button id="settings-word" class="settings-link">Buscar palabra ${icon('right')}</button></details>
    <details class="settings-section"><summary>Datos</summary><p class="small muted">Los libros y las notas se guardan en este navegador. No se descargan archivos automáticamente.</p></details>
    <details class="settings-section"><summary>Dispositivos</summary>${check('tvMode','Modo televisión')}${rangeControl('tvScale','Escala de televisión',1,2,.05,' ×')}<p class="small muted">Flechas para leer y recorrer controles; Intro para seleccionar. Compatible con mandos que envían teclas y con gamepads del navegador.</p><button id="settings-fullscreen" class="settings-link">Pantalla completa ${icon('expand')}</button><button id="settings-zen" class="settings-link">Modo zen ${icon('zen')}</button></details>
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
    <p class="small muted">En lectura vertical, sin marcas de palabra el seguimiento es aproximado. El audio externo usa el progreso de reproducción.</p>
    <div class="voice-actions"><button id="voice-preview" class="text-button">${icon('play')}Probar voz</button><button id="audio-stop" class="text-button">${icon('stop')}Detener</button></div>
  </aside>
  <div id="selection-menu" class="selection-menu" role="toolbar" aria-label="Texto seleccionado" hidden><button id="define-selection">Consultar</button><button id="annotate-selection">Anotar</button><button id="highlight-selection">Subrayar</button><button id="copy-selection">Copiar cita</button><button id="speak-selection">Leer desde aquí</button></div>
  <dialog id="file-dialog" class="file-dialog" aria-label="Abrir documento">
    <form method="dialog" class="dialog-dismiss">${iconButton('dismiss-file', 'close', 'Cerrar selector')}</form>
    <button id="choose-file" class="choose-file">${icon('open')}<span>Abrir un libro</span></button>
    <span class="file-types">EPUB · MOBI · Word · PDF · TXT</span>
    <button id="choose-folder" class="text-button">${icon('open')}Añadir carpeta</button>
    <div id="resume-list" class="resume-list"></div>
    <label class="check-field local-save"><input id="remember-file" type="checkbox" checked>Guardar el archivo en este navegador</label>
    <p id="file-error" class="error small" role="alert" hidden></p>
  </dialog>
  <dialog id="note-dialog" class="small-dialog" aria-labelledby="note-title"><div class="panel-heading"><h2 id="note-title">Nota de lectura</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><blockquote id="note-quote" data-user-content></blockquote><label class="field">Tu nota<textarea id="note-text" rows="5" maxlength="10000" placeholder="Escribe una nota…"></textarea></label><div class="filter-grid"><label class="field">Color<select id="note-color">${Object.entries(annotationColors).map(([id,value])=>`<option value="${id}">${value.label}</option>`).join('')}</select></label><label class="field">Marca<select id="note-style"><option value="underline">Subrayado</option><option value="highlight">Fondo resaltado</option></select></label></div><button id="save-note" class="primary-button">Guardar nota</button></dialog>
  <dialog id="notebook-dialog" class="notebook-dialog" aria-labelledby="notebook-title"><div class="panel-heading"><h2 id="notebook-title">Cuaderno de notas</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><div class="notebook-controls"><label class="field">Libro<select id="notebook-book"><option value="">Todos</option></select></label><label class="field">Tipo<select id="notebook-kind"><option value="">Todos</option><option value="note">Notas</option><option value="highlight">Subrayados</option><option value="bookmark">Marcadores</option></select></label><label class="field">Buscar notas<input id="notebook-search" type="search"></label></div><div class="editor-actions"><button id="notebook-export" class="text-button">Exportar selección</button><span id="notebook-count" class="small muted"></span></div><div id="notebook-list"></div><button id="notebook-more" class="text-button" hidden>Mostrar más</button></dialog>
  <dialog id="notes-export-dialog" class="small-dialog" aria-labelledby="notes-export-title"><div class="panel-heading"><h2 id="notes-export-title">Exportar notas</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><label class="field">Formato<select id="notes-export-format"><option value="md">Markdown</option><option value="json">JSON</option></select></label><label class="field">Vista previa<textarea id="notes-export-preview" rows="8" readonly></textarea></label><div class="editor-actions"><button id="notes-export-save" class="text-button">Guardar archivo</button><button id="notes-export-copy" class="text-button">Copiar exportación</button><button id="notes-export-pdf" class="text-button">Imprimir / guardar PDF</button><button id="notes-export-download" class="text-button" hidden>Descargar archivo</button></div><p id="notes-export-fallback" class="small muted" hidden>Este navegador no permite elegir destino. Puedes copiar el contenido o descargarlo expresamente.</p></dialog>
  <dialog id="dictionary-dialog" class="small-dialog" aria-labelledby="dictionary-word"><div class="panel-heading"><h2 id="dictionary-word" data-user-content></h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><form id="dictionary-search-form" class="search-field"><label class="sr-only" for="dictionary-query">Buscar palabra</label><input id="dictionary-query" placeholder="Buscar palabra" maxlength="200"><button aria-label="Buscar">${icon('search')}</button></form><label class="field">Idioma de consulta<select id="dictionary-language" data-setting="dictionaryLanguage"><option value="auto">Automático · idioma del libro</option>${Object.entries(languages).map(([code,name])=>`<option value="${code}" data-user-content>${name}</option>`).join('')}</select></label><p id="dictionary-definition"></p><p id="dictionary-source" class="small muted" data-user-content></p><a id="dictionary-license" class="text-link" target="_blank" rel="noopener noreferrer" hidden></a><div class="editor-actions"><button id="dictionary-save-word" class="text-button" disabled>Guardar palabra</button><button id="dictionary-manage" class="text-button">Diccionarios sin conexión</button></div><a id="dictionary-external" class="text-link" target="_blank" rel="noopener noreferrer">Consultar en Wikcionario ↗</a><label class="text-button dictionary-import">Importar diccionario propio<input id="dictionary-file" type="file" accept=".json" hidden></label><p class="small muted">La consulta local no envía palabras a Internet. El enlace externo solo se abre al pulsarlo.</p></dialog>
  <dialog id="dictionary-manager" class="dictionary-manager" aria-labelledby="dictionary-manager-title"><div class="panel-heading"><h2 id="dictionary-manager-title">Diccionarios sin conexión</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><p class="small muted">Instala solo los idiomas que necesites. Los paquetes se guardan dentro del navegador y se consultan sin conexión.</p><label class="field">Idioma<select id="dictionary-pack-language"><option value="">Todos</option>${Object.entries(languages).map(([code,name])=>`<option value="${code}" data-user-content>${name}</option>`).join('')}</select></label><label class="text-button dictionary-import">Importar diccionario propio<input id="dictionary-manager-file" type="file" accept=".json" hidden></label><div id="dictionary-install-progress" class="small" role="status" hidden><span id="dictionary-install-text"></span><button id="dictionary-install-cancel" class="text-button">Cancelar carga</button></div><div id="dictionary-pack-list"></div><p class="small muted">Wiktionary es una fuente colaborativa con cobertura variable. Catalán e hindi ofrecen aquí definiciones en inglés; puedes añadir paquetes propios en otros idiomas.</p></dialog>
  <dialog id="vocabulary-dialog" class="dictionary-manager" aria-labelledby="vocabulary-title"><div class="panel-heading"><h2 id="vocabulary-title">Vocabulario personal</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><div class="notebook-controls"><label class="field">Buscar palabra<input id="vocabulary-search" type="search"></label><label class="field">Estado<select id="vocabulary-state"><option value="">Todos</option><option value="learning">Aprendiendo</option><option value="learned">Aprendida</option></select></label></div><div id="vocabulary-list"></div><button id="vocabulary-more" class="text-button" hidden>Mostrar más</button></dialog>
  <dialog id="image-dialog" class="image-dialog" aria-label="Imagen ampliada"><div class="image-toolbar">${iconButton('zoom-out', 'minus', 'Reducir imagen')}<output id="zoom-level">100 %</output>${iconButton('zoom-in', 'plus', 'Ampliar imagen')}${iconButton('zoom-fit', 'expand', 'Ajustar imagen')}<button class="icon-button dialog-close" aria-label="Cerrar imagen">${icon('close')}</button></div><div class="image-stage"><img id="zoom-image" alt=""></div></dialog>
  <dialog id="library-dialog" class="library-dialog" aria-labelledby="library-dialog-title"><div class="panel-heading"><h2 id="library-dialog-title">Biblioteca</h2><button id="library-dialog-close" class="icon-button" aria-label="Cerrar biblioteca">${icon('close')}</button></div><div id="library-dialog-content"></div></dialog>
  <dialog id="organize-dialog" class="small-dialog" aria-labelledby="organize-title"><div class="panel-heading"><h2 id="organize-title" data-user-content></h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><form id="organize-form">
  <label class="field">Estado<select id="organize-status">${Object.entries(statuses).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label>
  <details class="settings-section"><summary>Datos del catálogo</summary><label class="field">Autor<input id="organize-author" maxlength="400"></label><label class="field">Géneros<textarea id="organize-genres" rows="2" maxlength="5000"></textarea></label><label class="field">Etiquetas<textarea id="organize-tags" rows="2" maxlength="5000"></textarea></label><p class="small muted">Un género o etiqueta por línea.</p><label class="field">Serie<input id="organize-series" maxlength="160"></label><label class="field">Número en la serie<input id="organize-series-index" type="number" step="any"></label><label class="field">Idioma<input id="organize-language" maxlength="20" placeholder="es, ca, en…"></label></details>
  <fieldset class="collection-fieldset"><legend>Colecciones</legend><div id="organize-collections"></div></fieldset>
  <div class="collection-create"><label class="sr-only" for="organize-collection-name">Nueva colección</label><input id="organize-collection-name" maxlength="80" placeholder="Nueva colección"><button id="organize-collection-create" class="icon-button" type="button" aria-label="Crear colección">${icon('plus')}</button></div>
  <p class="small muted">Estos cambios se guardan en el lector. Los archivos originales permanecen intactos.</p><button class="primary-button" type="submit">Guardar organización</button></form></dialog>
  <dialog id="duplicates-dialog" class="duplicates-dialog" aria-labelledby="duplicates-title"><div class="panel-heading"><h2 id="duplicates-title">Posibles duplicados</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><p class="small muted">Coincidencias de título y autor, identificadores o archivos ya abiertos. Pueden ser ediciones distintas; se muestran para revisión.</p><div id="duplicates-list"></div></dialog>
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
          <div><dt>Edición</dt><dd>Versión 1.0</dd></div>
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
  <dialog id="position-dialog" class="small-dialog" aria-labelledby="position-title"><div class="panel-heading"><h2 id="position-title">Posición del libro</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><p id="position-reference"></p><p class="small muted">La ubicación identifica el texto aunque cambie la pantalla o la tipografía. La página original solo se muestra si el libro la incluye.</p><label class="field">Porcentaje de lectura<input id="position-input" type="number" min="0" max="100" step="1"></label><button id="go-position" class="primary-button">Ir</button></dialog>
  <input id="file-input" type="file" accept=".epub,.mobi,.azw3,.docx,.doc,.pdf,.txt,.fb2" hidden>
  <div id="loading" class="loading" role="status" hidden><span class="loading-line"></span><span id="loading-text">Abriendo libro…</span></div>
  <div id="toast" class="toast" role="status" hidden></div>
`
const menuLayout = organizeMenus()
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

const coverQueue=new VisibleCoverQueue({load:loadLibraryCover,done:()=>updateLibrary(),onState:state=>{
  $('#cover-progress').hidden=!settings.preloadCovers
  $('#cover-progress-text').textContent=`${t(state.active?'Cargando portadas…':'Portadas listas')}: ${state.completed}`
  $('#pause-covers').hidden=coverQueuePaused;$('#resume-covers').hidden=!coverQueuePaused
}})
const speech = new SpeechController({
  view, settings: () => settings, getKey: () => apiKey,
  onState(state) {
    $('#audio-toggle').innerHTML = icon(state === 'playing' ? 'pause' : 'play')
    $('#audio-toggle').classList.toggle('active', ['playing', 'paused', 'loading'].includes(state))
    const label = ({ playing: 'Pausar lectura', paused: 'Continuar lectura', loading: 'Generando audio…', stopped: 'Leer en voz alta' })[state]
    $('#audio-toggle').setAttribute('aria-label', label); $('#audio-toggle').title = label
    $('#audio-toggle').setAttribute('aria-busy', state === 'loading')
    updateReadingInformation()
  },
  onError: message => { toast(message, 8000); if (settings.provider === 'openai' && !apiKey) togglePanel('voice') },
  onHighlight(range) {
    narratedRange = range
    if(range && record){record.anchorCFI=anchorCFI(range);if(speech.state==='playing')record.lastReadAt=Date.now();updateReadingInformation();if(performance.now()-lastSpeechSave>3000){lastSpeechSave=performance.now();saveRecord()}}
    for (const { doc } of view.renderer?.getContents() ?? []) doc.defaultView.CSS?.highlights?.delete('spoken')
    if (!range || !settings.highlight) return
    const win = range.startContainer.ownerDocument.defaultView
    if (win.Highlight && win.CSS.highlights) win.CSS.highlights.set('spoken', new win.Highlight(range))
  },
})
const gamepad=attachGamepad(()=>settings.tvMode,key=>{
  const target=document.activeElement??document.body
  if(key==='Enter'){if(target===view||target.tagName==='IFRAME')$('#audio-toggle').click();else target.click?.()}
  else target.dispatchEvent(new KeyboardEvent('keydown',{key,code:key,bubbles:true}))
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
    body { font-family: ${font} !important; font-size: ${settings.fontSize*(settings.tvMode?settings.tvScale:1)}px !important; line-height: ${settings.lineHeight} !important; color: ${colors.ink} !important; background: transparent !important; text-align: ${settings.justify ? 'justify' : 'left'} !important; overflow-wrap: break-word; }
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
  document.body.classList.toggle('tv-mode',settings.tvMode)
  document.body.classList.toggle('reading-info-visible',settings.showReference||settings.showChapterTime||settings.showBookTime)
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
    view.renderer.setAttribute('flow',settings.readingFlow)
    const count = window.innerWidth < 700 || settings.readingFlow==='scrolled' ? 1 : settings.columns
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
    output.textContent = settings[output.dataset.output] + (input.dataset.unit?.startsWith(' ')?' ':'')+t(input.dataset.unit?.trim()??'')
  })
  document.querySelectorAll('button[data-theme]').forEach(button => button.setAttribute('aria-pressed', button.dataset.theme === settings.theme))
  $('#api-voice-settings').hidden = settings.provider !== 'openai'
  $('#browser-voice-settings').hidden = settings.provider !== 'browser'
  speech.onHighlight(narratedRange)
  document.querySelector('[data-setting="columns"]').disabled=settings.readingFlow==='scrolled'
  gamepad.update();updateHistoryControls();updateReadingInformation()
  if(catalogItems.length)renderLibrary()
  if(record)for(const note of record.notes.filter(note=>note.kind!=='bookmark'))(settings.showAnnotations?view.addAnnotation({value:note.cfi}):view.deleteAnnotation({value:note.cfi})).catch(()=>{})
  if(!settings.showOpeningCover && !$('#opening-cover').hidden) attempt(()=>finishOpeningCover())()
  writeJSON('lector-settings', settings)
}

function closePanels() {
  menuLayout.moveSettings(false)
  menuLayout.clearSearch()
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
    menuLayout.moveSettings(name==='preferences')
    focusBeforePanel = $(`#${name}-toggle`); panel.hidden = false
    focusBeforePanel.setAttribute('aria-expanded', 'true')
    panel.querySelector('button').focus()
  }
  $('#selection-menu').hidden = true
}
function sidebar(open = $('#sidebar').hidden) {
  attempt(()=>preserveLayout(()=>{
    $('#sidebar').hidden = !open; document.body.classList.toggle('sidebar-open', open)
    $('#index-toggle').setAttribute('aria-expanded', open);applySettings()
  }))()
}
async function preserveLayout(change) {
  const origin=record?.anchorCFI??anchorCFI(),id=record?.id
  if(!origin||busy||speech.state==='playing'){change();return}
  const sequence=++layoutSequence;preservingAnchor=true;change()
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))
  if(sequence===layoutSequence&&record?.id===id){await view.goTo(origin);record.anchorCFI=origin;preservingAnchor=false;updateReadingInformation();saveRecord()}
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
  return saveBook(snapshot).catch(() => {
    if (!storageWarning) { storageWarning = true; toast('No se pudo guardar en este navegador. Las notas y el punto de lectura podrían perderse al cerrar.', 10000) }
  })
}

function anchorCFI(range) {
  const current=view.renderer?.getContents()[0]
  range??=narratedRange??view.lastLocation?.range
  if(!range||!current||range.startContainer.ownerDocument!==current.doc)return record?.anchorCFI??record?.cfi
  const point=range.cloneRange();point.collapse(true)
  // A wrapped space can have a rectangle on the previous page. Anchor a real
  // character instead, keeping the reference independent of the visible end.
  const node=point.startContainer
  if(node.nodeType===Node.TEXT_NODE){let offset=point.startOffset;while(offset<node.length&&/[\s\u00ad]/u.test(node.textContent[offset]))offset++;point.setStart(node,offset);if(offset<node.length)point.setEnd(node,offset+1)}
  else if(point.startOffset<node.childNodes.length)point.setEnd(node,point.startOffset+1)
  return view.getCFI(current.index,point)
}
function positionRange() {
  const current=view.renderer?.getContents()[0]
  if(!current?.doc?.body)return null
  if(narratedRange?.startContainer.ownerDocument===current.doc)return narratedRange
  const target=record?.anchorCFI&&view.resolveNavigation(record.anchorCFI)
  return target?.index===current.index&&typeof target.anchor==='function'?target.anchor(current.doc):view.lastLocation?.range
}
function updateHistoryControls() {
  $('#history-back').hidden=!settings.historyControls||!navigationTrail.past.length
  $('#history-forward').hidden=!settings.historyControls||!navigationTrail.future.length
}
function updateReadingInformation() {
  const current=view.renderer?.getContents()[0],range=positionRange()
  const info=$('#reading-information');info.hidden=!record||!(settings.showReference||settings.showChapterTime||settings.showBookTime)
  $('#stable-reference').hidden=!settings.showReference;$('#remaining-times').hidden=!(settings.showChapterTime||settings.showBookTime)
  if(info.hidden&&!$('#position-dialog').open)return
  if(!current||!range||!record)return
  const metrics=metricsCache.get(current.doc)??readingMetrics(current.doc,settings.language);metricsCache.set(current.doc,metrics)
  const position=metrics.position(range)
  const editorial=book.pdf?current.index+1:view.getProgressOf(current.index,range).pageItem?.label
  const reference=editorial?`${t('Página original')} ${editorial}`:`${t('Ubicación')} ${current.index+1}.${position.block}.${position.offset}`
  $('#stable-reference').textContent=reference;$('#position-reference').textContent=reference
  const wpm=settings.estimateMode==='audio'?settings.narrationWpm*settings.rate:settings.visualWpm
  const chapterEnd=chapterStarts.find(index=>index>current.index)??book.sections.length
  const time=estimateRemaining(book.sections,record.readingStats??{},current.index,position.words,wpm,chapterEnd)
  const parts=[]
  if(settings.showChapterTime)parts.push(`${t('Capítulo')}: ~${Math.ceil(time.chapter)} ${t('min')}`)
  if(settings.showBookTime)parts.push(time.book===null?`${t('Libro')}: —`:`${t('Libro')}: ~${Math.ceil(time.book)} ${t('min')}`)
  $('#remaining-times').textContent=parts.join(' · ')
}
async function navigateTo(target,fraction=false) {
  if(!book||busy)return
  layoutSequence++;preservingAnchor=false
  const origin=anchorCFI();speech.stop();await finishOpeningCover(false)
  if(fraction)await view.goToFraction(target);else await view.goTo(target)
  const destination=anchorCFI();navigationTrail.visit(origin,destination)
  record.navigationTrail=navigationTrail.snapshot();record.anchorCFI=destination;saveRecord();updateHistoryControls();updateReadingInformation()
}
async function navigateHistory(direction) {
  if(!book||busy)return
  const target=direction<0?navigationTrail.back(anchorCFI()):navigationTrail.forward(anchorCFI())
  if(!target)return
  layoutSequence++;preservingAnchor=false
  speech.stop();await finishOpeningCover(false);await view.goTo(target)
  record.anchorCFI=target;record.navigationTrail=navigationTrail.snapshot();saveRecord();updateHistoryControls();updateReadingInformation()
}
$('#history-back').onclick=attempt(()=>navigateHistory(-1))
$('#history-forward').onclick=attempt(()=>navigateHistory(1))

function renderTOC(items, target) {
  const list = document.createElement('ol')
  list.className = 'toc-list'
  for (const item of items) {
    const li = document.createElement('li'), button = document.createElement('button')
    button.className = 'toc-link'; button.textContent = item.label || 'Sin título'; button.dataset.href = item.href
    button.addEventListener('click', attempt(async () => {
      await navigateTo(item.href); $('#search-results').hidden = true
      if (innerWidth < 900) sidebar(false)
    }))
    li.append(button)
    if (item.subitems?.length) renderTOC(item.subitems, li)
    list.append(li)
  }
  target.append(list)
}

async function updateLibrary() {
  ;[localBooks,folderSources,catalogRecords,collections]=await Promise.all([allBooks(),allFolders(),allCatalog(),allCollections()])
  catalogItems=libraryEntries(localBooks,folderSources,catalogRecords)
  duplicateClusters=duplicateGroups(catalogItems);duplicateIDs=new Set(duplicateClusters.flatMap(group=>group.map(item=>item.id)))
  renderLibraryFilters()
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
    remove.disabled=Boolean(folderScan||metadataBatch)
    remove.onclick = attempt(async () => { if(folderScan||metadataBatch)return;coverQueue.cancel();await removeFolder(folder.id); await updateLibrary() })
    row.append(label,remove); $('#folder-list').append(row)
  }
}

function renderLibraryFilters(){
  const values={author:[],series:[],genre:[],tag:[],language:[],format:[]}
  for(const item of catalogItems){values.author.push(item.author,...item.authors);values.series.push(item.series);values.genre.push(...item.genres);values.tag.push(...item.tags);values.language.push(...item.languages);values.format.push(...item.formatNames)}
  const collator=new Intl.Collator(currentLanguage(),{numeric:true,sensitivity:'base'})
  for(const key of [...Object.keys(values),'status','collection']){
    const select=$(`#filter-${key}`),previous=select.value
    const options=key==='status'?Object.entries(statuses).map(([value,label])=>[value,t(label)]):key==='collection'?collections.map(item=>[item.id,item.name]):[...new Set(values[key].filter(Boolean))].sort(collator.compare).map(value=>[value,key==='format'?value.toUpperCase():value])
    select.replaceChildren(new Option(t('Todos'),''),...options.map(([value,label])=>{const option=new Option(label,value);if(key!=='status')option.dataset.userContent='';return option}))
    if(options.some(([value])=>value===previous))select.value=previous
  }
}
function clearLibraryFilters(){
  for(const select of document.querySelectorAll('[data-library-filter]'))select.value=''
  $('#library-search').value='';$('#filter-duplicates').checked=false;duplicateFocus=undefined;libraryLimit=60
}
async function readCatalogMetadata(item,signal){
  await ensureFolderPermission(item.folder.handle)
  if(signal?.aborted)return
  const data=await readMetadata(item)
  if(signal?.aborted)return
  Object.assign(item.folder.entries.find(entry=>entry.key===item.key),data,{opfLoaded:true})
  await updateCatalog(item.id,state=>({...state,metadata:catalogMetadata(data),source:'opf',updatedAt:Date.now()}))
  await saveFolder(item.folder)
}
async function readShownMetadata(){
  if(metadataBatch||folderScan)return
  const targets=shownLibrary.filter(item=>item.kind==='folder'&&item.metadata)
  const controller=metadataBatch=new AbortController();$('#metadata-progress').hidden=false;$('#read-visible-metadata').disabled=true
  coverQueue.cancel()
  $('#refresh-folders').disabled=true;$('#add-folder').disabled=true;renderFolders()
  let completed=0,failed=0
  try{for(const item of targets){
    if(controller.signal.aborted)break
    $('#metadata-progress-text').textContent=`${t('Leyendo metadatos…')} ${completed} / ${targets.length}`
    try{await readCatalogMetadata(item,controller.signal);if(!controller.signal.aborted)completed++}catch{failed++}
  }}finally{metadataBatch=null;$('#metadata-progress').hidden=true;$('#refresh-folders').disabled=false;$('#add-folder').disabled=false;await updateLibrary();toast(controller.signal.aborted?'Carga cancelada':failed?'No se pudieron leer algunos metadatos.':'Metadatos cargados')}
}
function renderCollectionChoices(selected=[]){
  const target=$('#organize-collections');target.replaceChildren()
  for(const collection of collections){const label=document.createElement('label');label.className='check-field';const input=document.createElement('input');input.type='checkbox';input.value=collection.id;input.checked=selected.includes(collection.id);const name=document.createElement('span');name.dataset.userContent='';name.textContent=collection.name;label.append(input,name);target.append(label)}
}
function openOrganize(item){
  organizingItem=item;$('#organize-title').textContent=item.title;$('#organize-status').value=item.status
  for(const [key,value] of Object.entries({author:item.author,genres:item.genres.join('\n'),tags:item.tags.join('\n'),series:item.series,'series-index':item.seriesIndex,language:item.language}))$(`#organize-${key}`).value=value??''
  $('#organize-collection-name').value='';renderCollectionChoices(item.collections);$('#organize-dialog').showModal()
}
async function createCollection(input){
  const name=input.value.trim().slice(0,80)
  if(!name)throw new Error(t('Escribe un nombre de colección.'))
  if(collections.some(item=>normalize(item.name)===normalize(name)))throw new Error(t('Esta colección ya existe.'))
  const collection={id:crypto.randomUUID(),name,createdAt:Date.now()};await saveCollection(collection);collections.push(collection);input.value='';return collection
}
async function saveOrganization(event){
  event.preventDefault();if(!organizingItem)return
  const position=$('#organize-series-index').value
  await updateCatalog(organizingItem.id,state=>({...state,status:$('#organize-status').value,overrides:{...state.overrides,
    author:$('#organize-author').value.trim(),genres:labels($('#organize-genres').value.split('\n')),tags:labels($('#organize-tags').value.split('\n')),
    series:$('#organize-series').value.trim(),seriesIndex:position===''?null:Number(position),language:languageCode($('#organize-language').value)},
    collections:[...$('#organize-collections').querySelectorAll('input:checked')].map(input=>input.value),updatedAt:Date.now()}))
  $('#organize-dialog').close();await updateLibrary();toast('Organización guardada')
}
function showDuplicates(){
  const target=$('#duplicates-list');target.replaceChildren()
  if(!duplicateClusters.length){const message=document.createElement('p');message.textContent=t('No hay coincidencias.');target.append(message)}
  for(const group of duplicateClusters.slice(0,100)){
    const section=document.createElement('section');section.className='duplicate-group'
    for(const item of group){const row=document.createElement('p');row.dataset.userContent='';row.textContent=[item.title,item.author,item.path??item.filename].filter(Boolean).join(' · ');section.append(row)}
    const button=document.createElement('button');button.className='text-button';button.textContent=t('Ver grupo en biblioteca');button.onclick=()=>{clearLibraryFilters();duplicateFocus=new Set(group.map(item=>item.id));$('#filter-duplicates').checked=true;$('#duplicates-dialog').close();$('#library-filter-dialog').close();if(!$('#library-dialog').open)openLibraryDialog();else renderLibrary()};section.append(button);target.append(section)
  }
  if(duplicateClusters.length>100){const more=document.createElement('p');more.textContent=t('Se muestran los primeros 100 grupos.');target.append(more)}
  $('#duplicates-dialog').showModal()
}
async function cacheBookMetadata(imported,current){
  const metadata=catalogMetadata(imported.metadata)
  await updateCatalog(catalogKey(current),state=>({...state,metadata:state.source==='opf'?state.metadata:metadata,source:state.source==='opf'?'opf':'book',
    fingerprints:[...new Set([...(state.fingerprints??[]),current.id])],status:!state.status||state.status==='pending'?(current.coverSeen?'reading':'pending'):state.status,updatedAt:Date.now()}))
}
async function markReading(){
  if(!record)return
  await updateCatalog(catalogKey(record),state=>({...state,status:!state.status||state.status==='pending'?'reading':state.status}))
  await updateLibrary()
}

function renderLibrary() {
  const coverTargets=new Map()
  const display=settings.libraryDialogView
  for (const url of libraryCoverURLs) URL.revokeObjectURL(url)
  libraryCoverURLs = []
  const query = $('#library-search').value.trim()
  const filters={query,sort:$('#library-sort').value,duplicates:$('#filter-duplicates').checked}
  for(const key of ['author','series','genre','tag','language','format','status','collection'])filters[key]=$(`#filter-${key}`).value
  const filtered=filterLibrary(catalogItems,filters,currentLanguage(),duplicateFocus??duplicateIDs)
  shownLibrary=filtered.slice(0,libraryLimit)
  $('#collection-delete').hidden=!filters.collection
  $('#read-visible-metadata').disabled=Boolean(metadataBatch)||!shownLibrary.some(item=>item.kind==='folder'&&item.metadata)
  $('#library-count').textContent = `${filtered.length.toLocaleString(currentLanguage())} ${t('libros')}`
  const list = $('#library-list'); list.replaceChildren(); list.classList.toggle('cover-grid', display === 'covers')
  document.querySelectorAll('[data-library-view]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.libraryView===(button.closest('#library-dialog')?display:settings.libraryView)))
  const activeFilters=Object.entries(filters).filter(([key,value])=>!['query','sort'].includes(key)&&value).length
  $('#library-filter-toggle').classList.toggle('active',Boolean(activeFilters))
  $('#library-filter-toggle').setAttribute('aria-pressed',Boolean(activeFilters))
  $('#library-filter-toggle').dataset.activeCount=activeFilters||''
  if (!filtered.length) { const empty = document.createElement('p'); empty.className = 'small muted'; empty.textContent = t(query ? 'No hay resultados.' : 'Los libros que abras aparecerán aquí.'); list.append(empty) }
  for (const item of shownLibrary) {
    const row = document.createElement('div'); row.className = 'library-row'
    if (display === 'covers') {
      const cover = document.createElement('button'); cover.className = 'catalog-cover'; cover.title = t(item.coverBlob?'Abrir libro':'Cargar portada'); cover.setAttribute('aria-label',`${cover.title}: ${item.title}`)
      if (item.coverBlob) {
        const image = document.createElement('img'); const url = URL.createObjectURL(item.coverBlob); libraryCoverURLs.push(url)
        image.src = url; image.alt = item.title; cover.append(image)
      } else cover.innerHTML = icon('book')
      cover.onclick = attempt(async () => {
        if (item.coverBlob) {await openLibraryItem(item);return}
        cover.disabled=true;cover.setAttribute('aria-busy','true')
        try {await loadLibraryCover(item);await updateLibrary()}finally{cover.disabled=false;cover.removeAttribute('aria-busy')}
      })
      row.append(cover)
      if(!item.coverBlob&&(item.kind==='folder'&&item.cover||settings.preloadEmbeddedCovers&&(item.kind==='folder'||item.file||item.fileHandle)))coverTargets.set(cover,item)
    }
    const content = document.createElement('div'); content.className = 'library-entry'
    const button = document.createElement('button'); button.className = 'library-book'; button.dataset.userContent = ''; button.textContent = item.title
    button.onclick = attempt(()=>openLibraryItem(item))
    content.append(button)
    if (item.author) { const author = document.createElement('span'); author.className = 'small muted'; author.dataset.userContent=''; author.textContent = item.author; content.append(author) }
    if(settings.libraryDetails){const details=document.createElement('span');details.className='small muted catalog-details';details.dataset.userContent='';details.textContent=[t(statuses[item.status]),item.series&&`${item.series}${item.seriesIndex===null?'':` · ${item.seriesIndex}`}`,...item.genres,...item.tags].filter(Boolean).join(' · ');content.append(details)}
    if (item.kind === 'folder') {
      const formats = document.createElement('div'); formats.className = 'catalog-formats'
      for (const format of item.formats) {
        const formatButton = document.createElement('button'); formatButton.textContent = format.extension.toUpperCase(); formatButton.onclick = attempt(()=>{closeLibraryDialog();return openFolderEntry(item.folder,item,format)}); formats.append(formatButton)
      }
      content.append(formats)
      if (item.metadata) {
        const metadata = document.createElement('button'); metadata.className = 'icon-button metadata-button'; metadata.innerHTML = icon('info');metadata.title=t('Leer metadatos');metadata.setAttribute('aria-label',metadata.title)
        metadata.onclick = attempt(async () => {
          await readCatalogMetadata(item);await updateLibrary();toast('Metadatos cargados')
        }); content.append(metadata)
      }
    }
    row.append(content)
    const actions=document.createElement('div');actions.className='library-row-actions'
    const organize=document.createElement('button');organize.className='icon-button organize-book';organize.innerHTML=icon('settings');organize.title=t('Organizar libro');organize.setAttribute('aria-label',`${organize.title}: ${item.title}`);organize.onclick=()=>openOrganize(item);actions.append(organize)
    if (item.kind === 'local') {
      const remove = document.createElement('button'); remove.className = 'icon-button'; remove.innerHTML = icon('trash'); remove.title = t('Quitar de la biblioteca'); remove.setAttribute('aria-label',t('Quitar de la biblioteca'))
      remove.onclick = attempt(async () => {
        if (item.notes?.length && !confirm(`${t('Quitar de la biblioteca')}: «${item.title}» (${item.notes.length})?`)) return
        if (record?.id === item.id) { clearTimeout(saveTimer); speech.stop();clearOpeningCover(); view.close(); book?.destroy?.(); book = null; record = null; $('#audio-toggle').disabled = true; $('.reading-footer').hidden = true }
        await removeBook(item.id);await removeCatalog(item.id); await updateLibrary()
      }); actions.append(remove)
    }
    row.append(actions)
    list.append(row)
  }
  $('#library-more').hidden = filtered.length <= libraryLimit
  renderSidebarLibrary(coverTargets)
  coverQueue.observe(coverTargets,settings.preloadCovers&&!coverQueuePaused&&!folderScan&&!metadataBatch)
}

let sidebarLibraryLimit=60
function renderSidebarLibrary(coverTargets) {
  const list=$('#sidebar-library-list'), items=recentReadingOrder(catalogItems,currentLanguage())
  list.replaceChildren();list.classList.toggle('cover-grid',settings.libraryView==='covers')
  for(const item of items.slice(0,sidebarLibraryLimit)) {
    const row=document.createElement('div');row.className='sidebar-library-row'
    if(settings.libraryView==='covers') {
      const cover=document.createElement('button');cover.className='sidebar-catalog-cover catalog-cover';cover.setAttribute('aria-label',`${t(item.coverBlob?'Abrir libro':'Cargar portada')}: ${item.title}`)
      if(item.coverBlob){const image=document.createElement('img'),url=URL.createObjectURL(item.coverBlob);libraryCoverURLs.push(url);image.src=url;image.alt=item.title;cover.append(image)}else cover.innerHTML=icon('book')
      cover.onclick=attempt(async()=>{if(item.coverBlob)await openLibraryItem(item);else {await loadLibraryCover(item);await updateLibrary()}})
      row.append(cover)
      if(!item.coverBlob&&(item.cover||settings.preloadEmbeddedCovers))coverTargets.set(cover,item)
    }
    const title=document.createElement('button');title.className='sidebar-book';title.dataset.userContent='';title.textContent=item.title;title.onclick=attempt(()=>openLibraryItem(item));row.append(title);list.append(row)
  }
  $('#sidebar-library-more').hidden=items.length<=sidebarLibraryLimit
}

function openLibraryDialog() {
  closePanels();$('#file-dialog').close()
  $('#library-dialog').showModal();renderLibrary()
}
function closeLibraryDialog() { for(const id of ['library-filter-dialog','library-sources-dialog','library-collections-dialog','library-dialog'])$(`#${id}`).close() }
$('#library-dialog').addEventListener('close',()=>{renderLibrary()})
for(const name of ['filter','sources','collections'])$(`#library-${name}-toggle`).onclick=()=> $(`#library-${name}-dialog`).showModal()
$('#sidebar-library-more').onclick=()=>{sidebarLibraryLimit+=60;renderLibrary()}
$('#library-dialog-close').onclick=closeLibraryDialog
$('#library-expand').onclick=openLibraryDialog
document.querySelectorAll('[data-library-view]').forEach(button=>button.onclick=()=>{
  settings[button.closest('#library-dialog')?'libraryDialogView':'libraryView']=button.dataset.libraryView;writeJSON('lector-settings',settings);renderLibrary()
})
async function openLibraryItem(item) {
  closeLibraryDialog()
  if(item.kind==='folder') await openFolderEntry(item.folder,item)
  else if(item.file || item.fileHandle) await openStored(item.id)
  else {toast('Vuelve a elegir el archivo para recuperar sus notas y su posición.');$('#file-input').click()}
}
async function coverDimensions(blob) {
  if(!(blob instanceof Blob) || !blob.size) throw new Error(t('Este libro no incluye una portada identificada.'))
  if(blob.size>12*1024*1024) throw new Error(t('La portada supera el límite de 12 MB.'))
  const url=URL.createObjectURL(blob),image=new Image();image.src=url
  try {await image.decode();return {width:image.naturalWidth,height:image.naturalHeight}}
  finally{URL.revokeObjectURL(url)}
}
async function loadLibraryCover(item,signal) {
  const check=()=>{if(signal?.aborted)throw new DOMException('Cancelled','AbortError')}
  let cover,imported
  try {
    check()
    if(item.kind==='folder') {
      await ensureFolderPermission(item.folder.handle)
      check()
      if(item.cover) cover=await item.cover.getFile()
      else {const file=await item.formats[0].handle.getFile();if(file.size>100*1024*1024) throw new Error(t('El límite de esta versión es de 100 MB por archivo.'));imported=await importBook(file,()=>{});cover=await imported.getCover?.()}
    } else if(record?.id===item.id) cover=record.coverBlob??await book?.getCover?.()
    else if(item.file || item.fileHandle) {
      if(item.fileHandle) await ensureFolderPermission(item.fileHandle)
      const file=item.fileHandle?await item.fileHandle.getFile():new File([item.file],item.filename,{type:item.file.type})
      imported=await importBook(file,()=>{});cover=await imported.getCover?.()
    } else throw new Error(t('Vuelve a elegir el archivo para recuperar sus notas y su posición.'))
    await coverDimensions(cover)
    check()
    if(item.kind==='folder') {
      const entry=item.folder.entries.find(entry=>entry.key===item.key);entry.coverBlob=cover;delete entry.coverInvalidated;await saveFolder(item.folder)
    } else {const original=await getBook(item.id);await saveBook({...original,coverBlob:cover});if(record?.id===item.id) record.coverBlob=cover}
  } finally{imported?.destroy?.()}
}

async function openFolderEntry(folder, entry, format = entry.formats[0]) {
  if (busy) return
  await ensureFolderPermission(folder.handle)
  const file = await format.handle.getFile()
  if (file.size > 100 * 1024 * 1024) throw new Error('El límite de esta versión es de 100 MB por archivo.')
  const id = await fileId(file)
  const previous = await getBook(id)
  let coverBlob=entry.coverBlob??(!entry.coverInvalidated?previous?.coverBlob:undefined)
  if(!coverBlob && entry.cover) {
    try {coverBlob=await entry.cover.getFile();await coverDimensions(coverBlob)}catch{coverBlob=undefined;toast('No se pudo mostrar la cubierta.')}
  }
  await openFile(file, { ...previous, id, folderId: folder.id, entryKey: entry.key, fileHandle: format.handle, author: entry.author, coverBlob, catalogTitle: entry.opfLoaded ? entry.title : undefined })
  if (record?.id === id) {
    const original = folder.entries.find(item=>item.key===entry.key)
    original.updatedAt = Date.now();original.coverBlob=record.coverBlob;delete original.coverInvalidated; await saveFolder(folder); await updateLibrary()
  }
  if (innerWidth < 900) sidebar(false)
}

async function indexFolder(folder) {
  if (folderScan||metadataBatch) return
  folderScan = new AbortController(); $('#folder-progress').hidden = false
  coverQueue.cancel()
  try {
    await ensureFolderPermission(folder.handle)
    const entries = await scanDirectory(folder.handle, { signal: folderScan.signal, onProgress: progress => {
      $('#folder-progress-text').textContent = `${t('Indexando carpetas…')} ${progress.books.toLocaleString(currentLanguage())} ${t('libros')}`
    } })
    const delta=await reconcileCatalog(folder.entries??[],entries,{signal:folderScan.signal})
    for(const change of delta.invalidated)await updateCatalog(`${folder.id}:${change.key}`,state=>({...state,...(change.metadata&&state.source==='opf'||change.content&&state.source==='book'?{metadata:undefined,source:undefined}:{}),...(change.content?{fingerprints:[]}: {})}))
    if(delta.dirty||!folder.entries?.length){folder.entries=delta.entries;folder.updatedAt=Date.now();await saveFolder(folder)}
    const labels={added:'Añadidos',changed:'Modificados',removed:'Retirados',unchanged:'Sin cambios'}
    $('#folder-summary').textContent=Object.entries(delta.stats).map(([key,count])=>`${t(labels[key])}: ${count}`).join(' · ');$('#folder-summary').hidden=false
    await updateLibrary()
  } finally { folderScan = null; $('#folder-progress').hidden = true;renderLibrary() }
}

async function connectFolder() {
  if (folderScan||metadataBatch) return
  if (!window.showDirectoryPicker) { toast('Para abrir carpetas sin leer todos sus archivos utiliza Chrome o Edge en HTTPS o localhost.', 12000); return }
  try {
    const handle = await window.showDirectoryPicker({ id: 'lector-library', mode: 'read' })
    const sources = await allFolders()
    let folder
    for (const source of sources) if (await handle.isSameEntry(source.handle)) { folder = source; break }
    folder ??= { id: crypto.randomUUID(), handle, name: handle.name, entries: [] }
    $('#file-dialog').close(); sidebar(true); $('[data-tab="library"]').click()
    openLibraryDialog();$('#library-sources-dialog').showModal()
    try {await indexFolder(folder)} finally {$('#library-sources-dialog').close()}
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
  selection=undefined
  busy = true; const sequence = ++loadSequence
  layoutSequence++;preservingAnchor=false
  $('#file-error').hidden = true; closePanels(); speech.stop();clearOpeningCover();$('#audio-toggle').disabled=true
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
      notes: saved?.notes ?? [], cfi: saved?.cfi,anchorCFI:saved?.anchorCFI,readingStats:saved?.readingStats??{},navigationTrail:saved?.navigationTrail,
      coverSeen:saved?.coverSeen??Boolean(saved?.cfi), lastReadAt:Date.now(), fraction: Number.isFinite(saved?.fraction) ? saved.fraction : 0, updatedAt: Date.now() }
    clearTimeout(saveTimer)
    view.close(); book?.destroy?.(); book = null; record = null
    await view.open(imported)
    book = imported; record = nextRecord;navigationTrail=new NavigationTrail(record.navigationTrail)
    chapterStarts=[...new Set([0,...(book.toc??[]).map(item=>view.resolveNavigation(item.href)?.index).filter(Number.isInteger)])].sort((a,b)=>a-b)
    if ($('#speech-language').value === 'auto') {
      settings.language = metadataText(book.metadata?.language) || currentLanguage()
      syncVoices()
    }
    applySettings()
    await view.init({ lastLocation: nextRecord.anchorCFI??nextRecord.cfi, showTextStart: !nextRecord.cfi })
    if (!view.renderer.getContents().length) throw new Error('No se pudo mostrar el primer capítulo del documento.')
    if (sequence !== loadSequence) return
    $('#book-title').dataset.userContent = ''; $('#book-title').textContent = title
    $('#toc').replaceChildren()
    renderTOC(book.toc?.length ? book.toc : book.sections.map((section, index) => ({ label: `Sección ${index + 1}`, href: index })), $('#toc'))
    let cover=record.coverBlob
    try {
      cover??=await book.getCover?.()
      const size=cover?await coverDimensions(cover):null
      record.coverBlob=cover
      if(size && size.width>4 && size.height>4 && settings.showOpeningCover && !record.coverSeen) showOpeningCover(cover,title)
      else {record.coverSeen=true;if(!saved?.cfi) await skipNativeCoverPage()}
    } catch {cover=undefined;record.coverBlob=undefined;toast('No se pudo mostrar la cubierta.')}
    $('#show-cover').hidden = !cover
    $('#audio-toggle').disabled = false; $('.reading-footer').hidden = false
    $('#search-results').hidden = true; $('#search-query').value = ''
    if($('#opening-cover').hidden)record.coverSeen=true
    $('#file-dialog').close(); renderNotes(); saveRecord()
    await cacheBookMetadata(book,record).catch(()=>{})
    await updateLibrary().catch(() => {})
    if (book.warning) toast(book.warning, 10000)
  } catch (error) {
    imported?.destroy?.()
    if (book === imported) { view.close(); book = null; record = null; $('#audio-toggle').disabled = true; $('.reading-footer').hidden = true }
    if (!$('#file-dialog').open) $('#file-dialog').showModal()
    $('#file-error').textContent = error.message || 'No se pudo abrir este documento.'; $('#file-error').hidden = false
  } finally { busy = false; $('#loading').hidden = true; $('#file-input').value = '';$('#audio-toggle').disabled=!book || !record }
}

view.addEventListener('relocate', ({ detail }) => {
  if (!record) return
  if(!$('#opening-cover').hidden && detail.reason==='navigation') attempt(()=>finishOpeningCover(false))()
  record.cfi = detail.cfi; record.fraction = Number.isFinite(detail.fraction) ? detail.fraction : record.fraction
  if(!busy&&!preservingAnchor&&detail.reason==='navigation')record.lastReadAt=Date.now()
  if(!preservingAnchor)record.anchorCFI=anchorCFI(narratedRange??detail.range)
  $('#chapter-name').textContent = detail.tocItem?.label ?? ''
  $('#progress-text').textContent = `${Math.round(record.fraction * 100)} %`
  $('#progress-line').style.width = `${Math.max(0, Math.min(100, record.fraction * 100))}%`
  document.querySelectorAll('.toc-link').forEach(button => {
    const active = String(button.dataset.href) === String(detail.tocItem?.href)
    button.classList.toggle('current', active)
    if (active) button.setAttribute('aria-current', 'location'); else button.removeAttribute('aria-current')
  })
  clearTimeout(saveTimer); saveTimer = setTimeout(saveRecord, 300)
  updateReadingInformation();updateHistoryControls()
})

view.addEventListener('load', ({ detail: { doc, index } }) => {
  doc.documentElement.lang ||= metadataText(book?.metadata?.language) || currentLanguage()
  if (doc.querySelector('img,svg') && (/cover|portada|cubierta/i.test(String(book?.sections[index]?.id ?? '')) || doc.body.textContent.trim().length < 5)) doc.body.classList.add('reader-cover')
  const metrics=readingMetrics(doc,settings.language);metricsCache.set(doc,metrics)
  if(record)record.readingStats[index]={words:doc.body.classList.contains('reader-cover')?0:metrics.total}
  doc.addEventListener('wheel',event=>{
    const renderer=view.renderer
    if(!renderer.scrolled||event.ctrlKey||!event.deltaY||busy||wheelTurning||document.querySelector('dialog[open]'))return
    if(event.deltaY>0&&renderer.end>=renderer.viewSize-2 || event.deltaY<0&&renderer.start<=1){
      event.preventDefault();wheelTurning=true;attempt(()=>changePage(Math.sign(event.deltaY)))().finally(()=>{wheelTurning=false})
    }
  },{passive:false})
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
      selection = { quote: selected.toString().trim(), cfi: view.getCFI(index, range), range,index }
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
  const href = event.detail.href
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
  } else {event.preventDefault();attempt(()=>navigateTo(href))()}
})

view.addEventListener('draw-annotation', ({ detail }) => {const note=record?.notes.find(note=>note.cfi===detail.annotation.value);if(settings.showAnnotations&&note)detail.draw(note.style==='highlight'?Overlayer.highlight:Overlayer.underline,{color:annotationColor(note)})})
view.addEventListener('create-overlay', ({ detail }) => {
  if (!record) return
  for (const note of record.notes) if (note.kind !== 'bookmark'&&settings.showAnnotations) view.addAnnotation({ value: note.cfi }).catch(() => {})
})
view.addEventListener('show-annotation', ({ detail }) => {
  const note = record?.notes.find(item => item.cfi === detail.value)
  if (note) openNoteEditor(record,note)
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
    navigate.append(quote, text); navigate.addEventListener('click', attempt(async () => { await navigateTo(note.cfi); if (innerWidth < 900) sidebar(false) }))
    if(note.kind!=='bookmark')quote.style.borderLeft=`2px solid ${annotationColor(note)}`
    const actions=noteActions(record,note)
    row.append(navigate,actions); list.append(row)
  }
}

function noteActions(source,note){
  const actions=document.createElement('div');actions.className='note-actions'
  for(const [name,symbol,action] of [['Editar nota','gear',()=>openNoteEditor(source,note)],['Copiar cita','note',()=>copyCitation(source,note)],['Eliminar nota','trash',()=>deleteNote(source,note)]]){
    const button=document.createElement('button');button.className='icon-button';button.innerHTML=icon(symbol);button.title=t(name);button.setAttribute('aria-label',t(name));button.onclick=attempt(action);actions.append(button)
  }
  return actions
}
function selectedNote(){
  if(!selection||!record)return null
  const index=selection.index,doc=selection.range.startContainer.ownerDocument,metrics=metricsCache.get(doc)??readingMetrics(doc,settings.language),position=metrics.position(selection.range)
  const original=book.pdf?index+1:view.getProgressOf(index,selection.range).pageItem?.label
  const reference=original?`${t('Página original')} ${original}`:`${t('Ubicación')} ${index+1}.${position.block}.${position.offset}`
  return {cfi:selection.cfi,quote:selection.quote,reference,label:view.lastLocation.tocItem?.label??'',fraction:record.fraction}
}
function openNoteEditor(source,note,kind='note'){
  const current=source.id===record?.id?record:source
  const existing=note.id?current.notes.find(item=>item.id===note.id):current.notes.find(item=>item.cfi===note.cfi&&item.kind!=='bookmark')
  editingNote={bookId:source.id,note:{...note,...existing},kind:existing?.kind??kind}
  $('#note-quote').textContent=note.quote??note.label??'';$('#note-text').value=existing?.text??note.text??''
  $('#note-color').value=existing?.color??'gold';$('#note-style').value=existing?.style??'underline'
  $('#note-color').disabled=editingNote.kind==='bookmark';$('#note-style').disabled=editingNote.kind==='bookmark'
  $('#selection-menu').hidden=true;$('#note-dialog').showModal();$('#note-text').focus()
}
async function saveNoteEdit(){
  if(!editingNote)return
  const source=editingNote.bookId===record?.id?record:await getBook(editingNote.bookId)
  if(!source)return
  const text=$('#note-text').value.trim(),note={...editingNote.note,id:editingNote.note.id??crypto.randomUUID(),kind:text?'note':editingNote.kind==='bookmark'?'bookmark':'highlight',text,
    color:$('#note-color').value,style:$('#note-style').value,createdAt:editingNote.note.createdAt??Date.now(),updatedAt:Date.now()}
  if(editingNote.kind==='bookmark')note.kind='bookmark'
  const index=source.notes.findIndex(item=>item.id===note.id)
  if(index>=0)source.notes[index]=note;else source.notes.push(note)
  if(source===record){if(note.kind!=='bookmark')await view.addAnnotation({value:note.cfi});await saveRecord();renderNotes()}else await saveBook({...source,updatedAt:Date.now()})
  $('#note-dialog').close();editingNote=undefined;await refreshNotebook();toast('Nota guardada')
}
async function deleteNote(source,note){
  const current=source.id===record?.id?record:await getBook(source.id);if(!current)return
  current.notes=current.notes.filter(item=>item.id!==note.id)
  if(current===record){if(note.kind!=='bookmark')await view.deleteAnnotation({value:note.cfi});await saveRecord();renderNotes()}else await saveBook({...current,updatedAt:Date.now()})
  await refreshNotebook()
}
async function copyCitation(source,note){await navigator.clipboard.writeText(citation(source,note));toast('Cita copiada')}
async function refreshNotebook(){
  if(!$('#notebook-dialog').open)return
  notebookBooks=await allBooks();if(record)notebookBooks=[record,...notebookBooks.filter(item=>item.id!==record.id)]
  const select=$('#notebook-book'),previous=select.value;select.replaceChildren(new Option(t('Todos'),''))
  for(const source of notebookBooks.filter(source=>source.notes?.length)){const option=new Option(source.title,source.id);option.dataset.userContent='';select.append(option)}
  if([...select.options].some(option=>option.value===previous))select.value=previous
  renderNotebook()
}
function renderNotebook(){
  notebookShown=notebookEntries(notebookBooks,{query:$('#notebook-search').value,bookId:$('#notebook-book').value,kind:$('#notebook-kind').value})
  const list=$('#notebook-list');list.replaceChildren();$('#notebook-count').textContent=String(notebookShown.length)
  for(const {book:source,note} of notebookShown.slice(0,notebookLimit)){
    const row=document.createElement('article');row.className='notebook-row'
    const content=document.createElement('div'),heading=document.createElement('button');heading.className='text-button';heading.dataset.userContent='';heading.textContent=[source.title,note.reference??note.label].filter(Boolean).join(' · ')
    heading.onclick=attempt(async()=>{if(record?.id!==source.id)await openStored(source.id);if(record?.id===source.id){$('#notebook-dialog').close();await navigateTo(note.cfi)}})
    const quote=document.createElement('blockquote');quote.dataset.userContent='';quote.textContent=note.quote??'';if(note.kind!=='bookmark')quote.style.borderLeftColor=annotationColor(note)
    const body=document.createElement('p');body.dataset.userContent='';body.textContent=note.text??'';content.append(heading,quote,body)
    row.append(content,noteActions(source,note));list.append(row)
  }
  $('#notebook-more').hidden=notebookShown.length<=notebookLimit
}
async function openNotebook(){closePanels();notebookLimit=100;if(!$('#notebook-dialog').open)$('#notebook-dialog').showModal();await refreshNotebook()}
function openNotesExport(entries){exportEntries=entries;$('#notes-export-download').hidden=true;$('#notes-export-fallback').hidden=true;renderNotesExport();$('#notes-export-dialog').showModal()}
function renderNotesExport(){const format=$('#notes-export-format').value;$('#notes-export-preview').value=format==='md'?notesMarkdown(exportEntries,t('Notas y citas')):JSON.stringify(exportEntries.map(({book,note})=>({book:book.title,author:book.author,note})),null,2)}
function dictionaryLanguage(){const language=settings.dictionaryLanguage==='auto'?languageCode(book?.metadata?.language)||currentLanguage():settings.dictionaryLanguage;return Object.hasOwn(languages,language)?language:currentLanguage()}
async function lookupDictionary(word=$('#dictionary-query').value){
  const language=dictionaryLanguage(),key=normalizeTerm(word,language),sequence=++dictionaryQuerySequence
  dictionaryResult=undefined;$('#dictionary-save-word').disabled=true;$('#dictionary-word').textContent=key||t('Buscar palabra');$('#dictionary-query').value=key;$('#dictionary-language').value=settings.dictionaryLanguage
  $('#dictionary-definition').textContent=key?t('Buscando…'):'';$('#dictionary-source').textContent='';$('#dictionary-license').hidden=true
  const result=key?await lookupOffline(key,language):null
  if(sequence!==dictionaryQuerySequence)return
  dictionaryResult=result?{...result,language}:undefined
  $('#dictionary-definition').textContent=result?.definition??(key?t('No se encontró en los diccionarios instalados.'):t('Selecciona una palabra o escribe una consulta.'))
  $('#dictionary-save-word').disabled=!result
  if(result){$('#dictionary-source').textContent=result.basic?t('Glosario básico'): `${result.pack.name} · ${t('Definiciones')}: ${languages[result.pack.definitionLanguage]} · ${result.pack.entries.toLocaleString(currentLanguage())} ${t('entradas')}`
    if(result.pack?.licenseURL&&/^https:\/\//.test(result.pack.licenseURL)){$('#dictionary-license').textContent=result.pack.license;$('#dictionary-license').href=result.pack.licenseURL;$('#dictionary-license').hidden=false}}
  $('#dictionary-external').href=result?.sourceURL||`https://${language}.wiktionary.org/wiki/${encodeURIComponent(key)}`;$('#dictionary-external').hidden=!key
}
async function openWordDictionary(word=''){closePanels();$('#selection-menu').hidden=true;if(!$('#dictionary-dialog').open)$('#dictionary-dialog').showModal();await lookupDictionary(word)}
function dictionaryProgress(progress){$('#dictionary-install-text').textContent=`${t('Instalando diccionario…')} ${progress.completed} / ${progress.total}`}
async function dictionaryJob(action){
  if(dictionaryInstall)return
  const controller=dictionaryInstall=new AbortController();$('#dictionary-install-progress').hidden=false;$('#dictionary-install-text').textContent=t('Instalando diccionario…');await renderDictionaryManager()
  try{await action({signal:controller.signal,onProgress:dictionaryProgress});clearDictionaryCache();toast('Diccionario instalado')}
  catch(error){if(controller.signal.aborted)toast('Carga cancelada');else handleError(error)}
  finally{dictionaryInstall=undefined;$('#dictionary-install-progress').hidden=true;await renderDictionaryManager();if($('#dictionary-dialog').open)await lookupDictionary()}
}
async function openDictionaryManager(){closePanels();if(!$('#dictionary-manager').open)$('#dictionary-manager').showModal();await renderDictionaryManager()}
async function renderDictionaryManager(){
  dictionaryResourcesPromise??=import('./dictionary-resources.js').then(resources=>{projectDictionaries=resources.projectDictionaries;personalProjectDictionaries=resources.personalProjectDictionaries}).catch(()=>{dictionaryResourcesPromise=undefined})
  await dictionaryResourcesPromise
  const installed=await allDictionaryPacks(),active=new Set(installed.filter(pack=>pack.installed).map(pack=>pack.id)),list=$('#dictionary-pack-list'),language=$('#dictionary-pack-language').value
  list.replaceChildren()
  for(const pack of [...projectDictionaries,...installed.filter(pack=>!projectDictionaries.some(resource=>resource.id===pack.id))]){
    if(language&&pack.language!==language)continue
    const row=document.createElement('div');row.className='dictionary-pack-row';const content=document.createElement('div'),name=document.createElement('p'),details=document.createElement('p')
    name.dataset.userContent='';name.textContent=`${languages[pack.language]} · ${pack.name}`;details.className='small muted';details.dataset.userContent=''
    details.textContent=[`${pack.entries.toLocaleString(currentLanguage())} ${t('entradas')}`,`${(pack.bytes/1024/1024).toFixed(1)} MB`,`${t('Definiciones')}: ${languages[pack.definitionLanguage]}`,pack.license,active.has(pack.id)?t('Instalado'):pack.installed===false?t('Instalación incompleta'):t('Sin instalar')].join(' · ')
    const resource=projectDictionaries.some(value=>value.id===pack.id)
    content.append(name,details);const button=document.createElement('button');button.className='text-button';button.disabled=Boolean(dictionaryInstall);button.textContent=t(active.has(pack.id)||!resource?'Eliminar paquete':'Instalar')
    button.onclick=attempt(async()=>{if(dictionaryInstall)return;if(active.has(pack.id)||!resource){await uninstallDictionary(pack.id);await renderDictionaryManager()}else await dictionaryJob(options=>installDictionary(pack,options))})
    row.append(content,button);list.append(row)
  }
  for(const resource of personalProjectDictionaries){if(language&&resource.language&&resource.language!==language)continue;const row=document.createElement('div');row.className='dictionary-pack-row';const name=document.createElement('span');name.dataset.userContent='';name.textContent=resource.name;const button=document.createElement('button');button.className='text-button';button.textContent=t('Instalar');button.disabled=Boolean(dictionaryInstall);button.onclick=()=>dictionaryJob(async options=>{const response=await fetch(resource.url,{signal:options.signal});if(!response.ok)throw Error(t('No se pudo cargar el paquete de diccionario.'));const blob=await response.blob();await importOfflineDictionary(new File([blob],resource.name),resource.language||language||dictionaryLanguage(),options)});row.append(name,button);list.append(row)}
}
async function importPersonalDictionary(input){const file=input.files[0];if(!file)return;const language=input.id==='dictionary-file'?dictionaryLanguage():$('#dictionary-pack-language').value||dictionaryLanguage();try{await dictionaryJob(options=>importOfflineDictionary(file,language,options))}finally{input.value=''}}
async function rememberWord(){
  if(!dictionaryResult)return
  const result=dictionaryResult,id=`${result.language}:${result.word}`,previous=(await allVocabulary()).find(word=>word.id===id)
  const selected=selection&&normalizeTerm(selection.quote,result.language)===result.word?selectedNote():null
  await saveVocabulary({...previous,id,word:result.word,language:result.language,definition:result.definition,definitionLanguage:result.pack?.definitionLanguage??result.language,license:result.pack?.license,sourceURL:result.sourceURL,
    ...(selected?{bookId:record.id,bookTitle:record.title,cfi:selected.cfi,reference:selected.reference}:{}),status:previous?.status??'learning',createdAt:previous?.createdAt??Date.now(),updatedAt:Date.now()});toast('Palabra guardada')
}
async function renderVocabulary(){
  const query=normalizeTerm($('#vocabulary-search').value,currentLanguage()),state=$('#vocabulary-state').value
  const words=(await allVocabulary()).filter(word=>(!query||normalizeTerm(`${word.word} ${word.note??''} ${word.definition}`,word.language).includes(query))&&(!state||word.status===state)).sort((a,b)=>b.updatedAt-a.updatedAt)
  const list=$('#vocabulary-list');list.replaceChildren()
  for(const word of words.slice(0,vocabularyLimit)){
    const row=document.createElement('details');row.className='vocabulary-row';const summary=document.createElement('summary');summary.dataset.userContent='';summary.textContent=`${word.word} · ${languages[word.language]} · ${t(word.status==='learned'?'Aprendida':'Aprendiendo')}`
    const definition=document.createElement('p');definition.dataset.userContent='';definition.className='dictionary-definition';definition.textContent=word.definition
    const source=document.createElement('p');source.dataset.userContent='';source.className='small muted';source.textContent=[`${t('Definiciones')}: ${languages[word.definitionLanguage]}`,word.bookTitle,word.reference,word.license].filter(Boolean).join(' · ')
    const label=document.createElement('label');label.className='field';const labelText=document.createElement('span');labelText.textContent=t('Tu nota');const input=document.createElement('textarea');input.rows=2;input.maxLength=5000;input.value=word.note??'';label.append(labelText,input)
    const learned=document.createElement('label');learned.className='check-field';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=word.status==='learned';const learnedText=document.createElement('span');learnedText.textContent=t('Aprendida');learned.append(checkbox,learnedText)
    const actions=document.createElement('div');actions.className='editor-actions'
    const save=document.createElement('button');save.className='text-button';save.textContent=t('Guardar');save.onclick=attempt(async()=>{await saveVocabulary({...word,note:input.value.trim(),status:checkbox.checked?'learned':'learning',updatedAt:Date.now()});await renderVocabulary()})
    const remove=document.createElement('button');remove.className='text-button';remove.textContent=t('Eliminar');remove.onclick=attempt(async()=>{await removeVocabulary(word.id);await renderVocabulary()});actions.append(save,remove)
    if(word.sourceURL&&/^https:\/\//.test(word.sourceURL)){const link=document.createElement('a');link.className='text-link';link.href=word.sourceURL;link.target='_blank';link.rel='noopener noreferrer';link.textContent=t('Fuente');actions.append(link)}
    row.append(summary,definition,source,label,learned,actions);list.append(row)
  }
  $('#vocabulary-more').hidden=words.length<=vocabularyLimit
}
async function openVocabulary(){closePanels();vocabularyLimit=100;if(!$('#vocabulary-dialog').open)$('#vocabulary-dialog').showModal();await renderVocabulary()}
function exportBlob(){return new Blob([$('#notes-export-preview').value],{type:$('#notes-export-format').value==='md'?'text/markdown;charset=utf-8':'application/json'})}
async function saveNotesExport(){
  if(!window.showSaveFilePicker){$('#notes-export-download').hidden=false;$('#notes-export-fallback').hidden=false;return}
  const extension=$('#notes-export-format').value
  try{const handle=await window.showSaveFilePicker({suggestedName:`lector-notas.${extension}`,types:[{description:extension==='md'?'Markdown':'JSON',accept:{[extension==='md'?'text/markdown':'application/json']:[`.${extension}`]}}]}),stream=await handle.createWritable();await stream.write(exportBlob());await stream.close();toast('Exportación guardada')}catch(error){if(error.name!=='AbortError')throw error}
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

function clearOpeningCover() {
  $('#opening-cover').hidden=true;view.inert=false;$('#reading-area').classList.remove('cover-open')
  $('#opening-cover-image').removeAttribute('src')
  if(openingCoverURL) URL.revokeObjectURL(openingCoverURL)
  openingCoverURL=undefined
}
function showOpeningCover(cover,title) {
  clearOpeningCover();openingCoverURL=URL.createObjectURL(cover)
  $('#opening-cover-image').src=openingCoverURL;$('#opening-cover-image').alt=title
  $('#opening-cover').hidden=false;view.inert=true;$('#reading-area').classList.add('cover-open')
}
async function skipNativeCoverPage() {
  const current=view.renderer?.getContents()[0]
  if(current?.doc.body.classList.contains('reader-cover') && current.index+1<book.sections.length) await view.goTo(current.index+1)
}
async function finishOpeningCover(skip=true) {
  if($('#opening-cover').hidden) return
  clearOpeningCover();if(record) record.coverSeen=true
  if(skip) await skipNativeCoverPage()
  saveRecord()
  await markReading().catch(()=>{})
}
$('#start-reading').onclick=attempt(async()=>{await finishOpeningCover();$('#audio-toggle').focus({preventScroll:true})})
$('#opening-cover-zoom').onclick=()=>{if(openingCoverURL) showImage(openingCoverURL,record?.title??'')}

async function changePage(direction) {
  if (!book || busy || document.querySelector('dialog[open]')) return
  layoutSequence++;preservingAnchor=false
  if(!$('#opening-cover').hidden) {if(direction>0) await finishOpeningCover();return}
  speech.stop(); $('#selection-menu').hidden = true
  await (direction > 0 ? view.next() : view.prev())
}

function onKey(event) {
  if (event.defaultPrevented) return
  const target = event.target
  if(event.key==='MediaPlayPause'){event.preventDefault();$('#audio-toggle').click();return}
  if(settings.tvMode&&event.key==='Enter'&&(target===view||target.ownerDocument!==document)){event.preventDefault();$('#audio-toggle').click();return}
  if(event.altKey&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();attempt(()=>navigateHistory(event.key==='ArrowLeft'?-1:1))();return}
  if(settings.tvMode && ['Backspace','BrowserBack'].includes(event.key)&&!target.closest?.('input,textarea')){event.preventDefault();if(document.querySelector('.panel:not([hidden])'))closePanels();else attempt(()=>navigateHistory(-1))();return}
  if (event.key === 'Escape') {
    closePanels(); $('#selection-menu').hidden = true
    if (document.body.classList.contains('zen')) setZen(false)
    if(settings.tvMode)$('#preferences-toggle').focus({preventScroll:true})
    return
  }
  if (target.closest?.('input,textarea,select,[contenteditable="true"]')) return
  if(settings.tvMode&&event.key.startsWith('Arrow')&&target.closest?.('button,a,summary')){event.preventDefault();moveFocus(event.key,document.querySelector('dialog[open]')??document);return}
  if (document.querySelector('dialog[open]')) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') { event.preventDefault(); $('#file-input').click(); return }
  if (event.ctrlKey || event.altKey || event.metaKey) return
  if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); attempt(() => changePage(1))() }
  else if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); attempt(() => changePage(-1))() }
  else if(['ArrowUp','ArrowDown'].includes(event.key)&&(settings.tvMode||settings.readingFlow==='scrolled')){event.preventDefault();attempt(()=>changePage(event.key==='ArrowUp'?-1:1))()}
  else if (event.key.toLowerCase() === 'z') setZen(!document.body.classList.contains('zen'))
  else if (event.key.toLowerCase() === 'f') attempt(toggleFullscreen)()
  else if (event.code === 'Space' && book && !target.closest?.('button,a')) { event.preventDefault(); $('#audio-toggle').click() }
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
$('#audio-toggle').onclick = attempt(async()=>{await finishOpeningCover();await speech.toggle()})
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
  input.addEventListener(['range', 'checkbox'].includes(input.type) || input.tagName === 'SELECT' ? 'input' : 'change', async () => {
    const layout=['readingFlow','font','fontSize','lineHeight','paragraphGap','columns','width','gutter','fullWidth','marginOuter','marginInner','hyphenate','tvMode','tvScale'].includes(input.dataset.setting)
    const origin=layout&&book?(preservingAnchor?record.anchorCFI:anchorCFI()):null,sequence=layout?++layoutSequence:layoutSequence,id=record?.id
    if(layout){speech.stop();preservingAnchor=Boolean(origin)}
    if (['provider', 'voice', 'rate', 'pitch', 'endpoint', 'model', 'apiVoice', 'instructions'].includes(input.dataset.setting)) speech.stop()
    settings[input.dataset.setting] = input.type === 'checkbox' ? input.checked : input.type === 'range' || input.dataset.setting === 'columns' ? Number(input.value) : input.value
    if (input.dataset.setting === 'uiLanguage') {
      setUILanguage(settings.uiLanguage)
      renderLibraryFilters();renderLibrary(); syncVoices()
    }
    if (input.dataset.setting === 'libraryView') renderLibrary()
    if(['preloadCovers','preloadEmbeddedCovers'].includes(input.dataset.setting)){coverQueuePaused=false;coverQueue.cancel();coverQueue.retry()}
    Object.assign(settings, safeSettings(settings)); applySettings()
    if(origin){await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(sequence===layoutSequence&&record?.id===id){await view.goTo(origin);record.anchorCFI=origin;preservingAnchor=false;updateReadingInformation();saveRecord()}}
  })
})
$('#api-key').oninput = event => { speech.stop(); apiKey = event.target.value.trim() }
document.querySelectorAll('[data-settings-panel]').forEach(button=>button.onclick=()=>togglePanel(button.dataset.settingsPanel))
document.querySelectorAll('[data-settings-tab]').forEach(button=>button.onclick=()=>{
  if(button.dataset.settingsTab==='library') {openLibraryDialog();return}
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
  const cover = record?.coverBlob ?? await book?.getCover?.()
  if (!cover) { toast('Este libro no incluye una portada identificada.'); return }
  if (record) { record.coverBlob = cover; saveRecord(); await updateLibrary() }
  const url = URL.createObjectURL(cover)
  showImage(url, `Portada de ${record.title}`)
  $('#image-dialog').addEventListener('close', () => URL.revokeObjectURL(url), { once: true })
})
$('#define-selection').onclick = attempt(()=>openWordDictionary(selection.quote))
$('#dictionary-file').onchange=attempt(()=>importPersonalDictionary($('#dictionary-file')))
$('#dictionary-manager-file').onchange=attempt(()=>importPersonalDictionary($('#dictionary-manager-file')))
$('#settings-dictionaries').onclick=attempt(openDictionaryManager);$('#dictionary-manage').onclick=attempt(openDictionaryManager)
$('#settings-vocabulary').onclick=attempt(openVocabulary)
$('#settings-word').onclick=attempt(()=>openWordDictionary())
$('#dictionary-search-form').onsubmit=attempt(async event=>{event.preventDefault();await lookupDictionary()})
$('#dictionary-language').onchange=attempt(()=>lookupDictionary())
$('#dictionary-pack-language').onchange=attempt(renderDictionaryManager)
$('#dictionary-install-cancel').onclick=()=>dictionaryInstall?.abort()
$('#dictionary-save-word').onclick=attempt(rememberWord)
for(const id of ['vocabulary-search','vocabulary-state'])$(`#${id}`).addEventListener(id==='vocabulary-search'?'input':'change',attempt(async()=>{vocabularyLimit=100;await renderVocabulary()}))
$('#vocabulary-more').onclick=attempt(async()=>{vocabularyLimit+=100;await renderVocabulary()})
$('#annotate-selection').onclick = () => {const note=selectedNote();if(note)openNoteEditor(record,note)}
$('#highlight-selection').onclick = () => {const note=selectedNote();if(note)openNoteEditor(record,note,'highlight')}
$('#copy-selection').onclick=attempt(async()=>{const note=selectedNote();if(note)await copyCitation(record,note)})
$('#save-note').onclick = attempt(saveNoteEdit)
$('#speak-selection').onclick = attempt(async () => {
  speech.stop(); await view.select(selection.cfi); $('#selection-menu').hidden = true; await speech.restart(selection.range)
})
$('#add-bookmark').onclick = () => {
  if (!record || !view.lastLocation) return
  if (record.notes.some(note => note.kind === 'bookmark' && note.cfi === record.cfi)) { toast('Esta posición ya tiene un marcador.'); return }
  record.notes.push({ id: crypto.randomUUID(), kind: 'bookmark', cfi: record.cfi, fraction: record.fraction, label: view.lastLocation.tocItem?.label ?? '', text: '', createdAt: Date.now() })
  saveRecord(); renderNotes(); toast('Página marcada')
}
$('#export-notes').onclick = () => {if(record)openNotesExport(record.notes.map(note=>({book:record,note})))}
$('#open-notebook').onclick=attempt(openNotebook);$('#settings-notebook').onclick=attempt(openNotebook)
for(const id of ['notebook-book','notebook-kind','notebook-search'])$(`#${id}`).addEventListener(id==='notebook-search'?'input':'change',()=>{notebookLimit=100;renderNotebook()})
$('#notebook-more').onclick=()=>{notebookLimit+=100;renderNotebook()}
$('#notebook-export').onclick=()=>openNotesExport(notebookShown)
$('#notes-export-format').onchange=renderNotesExport
$('#notes-export-save').onclick=attempt(saveNotesExport)
$('#notes-export-copy').onclick=attempt(async()=>{await navigator.clipboard.writeText($('#notes-export-preview').value);toast('Exportación copiada')})
$('#notes-export-download').onclick=()=>{const url=URL.createObjectURL(exportBlob()),anchor=document.createElement('a');anchor.href=url;anchor.download=`lector-notas.${$('#notes-export-format').value}`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('#notes-export-pdf').onclick=()=>{const popup=window.open('','_blank');if(!popup){toast('Permite abrir la ventana de impresión.');return}popup.opener=null;popup.document.write(notesHTML(exportEntries,t('Notas y citas')));popup.document.close();popup.focus();popup.print()}
$('#zoom-in').onclick = () => imageViewer.step(.25)
$('#zoom-out').onclick = () => imageViewer.step(-.25)
$('#zoom-fit').onclick = fitImage
$('#image-dialog').addEventListener('close', () => { $('#zoom-image').removeAttribute('src') })
$('#dismiss-zen-hint').onclick = dismissZenHint
$('#choose-folder').onclick = connectFolder
$('#add-folder').onclick = connectFolder
$('#cancel-scan').onclick = () => folderScan?.abort()
$('#pause-covers').onclick=()=>{coverQueuePaused=true;coverQueue.cancel();renderLibrary()}
$('#resume-covers').onclick=()=>{coverQueuePaused=false;coverQueue.retry();renderLibrary()}
$('#refresh-folders').onclick = attempt(async () => {
  for (const folder of folderSources) {
    try { await indexFolder(folder) } catch (error) { if (error.name === 'AbortError') break; throw error }
  }
})
$('#library-search').oninput = () => { libraryLimit = 60; renderLibrary() }
$('#library-sort').onchange = () => { libraryLimit = 60; renderLibrary() }
document.querySelectorAll('[data-library-filter]').forEach(select=>select.onchange=()=>{libraryLimit=60;renderLibrary()})
$('#filter-duplicates').onchange=()=>{duplicateFocus=undefined;libraryLimit=60;renderLibrary()}
$('#clear-library-filters').onclick=()=>{clearLibraryFilters();renderLibrary()}
$('#show-duplicates').onclick=showDuplicates
$('#read-visible-metadata').onclick=attempt(readShownMetadata)
$('#metadata-cancel').onclick=()=>metadataBatch?.abort()
$('#collection-create').onclick=attempt(async()=>{await createCollection($('#collection-name'));await updateLibrary()})
$('#collection-delete').onclick=attempt(async()=>{const id=$('#filter-collection').value;if(id){await removeCollection(id);await updateLibrary()}})
$('#organize-form').onsubmit=attempt(saveOrganization)
$('#organize-collection-create').onclick=attempt(async()=>{const selected=[...$('#organize-collections').querySelectorAll('input:checked')].map(input=>input.value);const collection=await createCollection($('#organize-collection-name'));renderCollectionChoices([...selected,collection.id]);renderLibraryFilters()})
$('#library-more').onclick = () => { libraryLimit += 60; renderLibrary() }
$('#speech-language').onchange = () => {
  speech.stop()
  settings.speechLanguage = $('#speech-language').value
  settings.language = $('#speech-language').value === 'auto' ? metadataText(book?.metadata?.language) || currentLanguage() : $('#speech-language').value
  syncVoices(); applySettings()
}
$('#position-button').onclick = () => { $('#position-input').value = Math.round((record?.fraction ?? 0) * 100); $('#position-dialog').showModal();updateReadingInformation() }
$('#go-position').onclick = attempt(async () => {
  if (!book || !$('#position-input').reportValidity()) return
  await navigateTo(Number($('#position-input').value)/100,true); $('#position-dialog').close()
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
      button.onclick = attempt(async () => { await navigateTo(match.cfi); if (innerWidth < 900) sidebar(false) })
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
window.addEventListener('pagehide', () => { saveRecord(); speech.stop();gamepad.dispose() })
window.addEventListener('resize', attempt(()=>preserveLayout(()=>{ $('#selection-menu').hidden = true; applySettings() })))
globalThis.speechSynthesis?.addEventListener('voiceschanged', syncVoices)
setInterval(() => { if (settings.theme === 'auto') applySettings() }, 60000)
applySettings(); syncVoices(); translateUI()
updateLibrary().catch(() => toast('El almacenamiento local no está disponible. Puedes abrir un libro, pero no se guardará al cerrar.'))
$('#file-dialog').showModal()
