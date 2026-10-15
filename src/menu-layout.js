import { icon } from './icons.js'
import { normalize } from './library.js'

// Move the existing controls rather than maintaining two copies of preferences.
export function organizeMenus() {
  const $ = selector => document.querySelector(selector)
  const dialog = (id, title) => {
    const element = document.createElement('dialog')
    element.id = id; element.className = 'small-dialog library-subdialog'
    element.setAttribute('aria-labelledby', `${id}-title`)
    element.innerHTML = `<div class="panel-heading"><h2 id="${id}-title">${title}</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div>`
    $('#app').append(element)
    return element
  }
  const button = (id, glyph, label) => `<button id="${id}" class="icon-button" aria-label="${label}" title="${label}">${icon(glyph)}</button>`
  $('#library-dialog-content').append($('#library-content'))
  const filters = dialog('library-filter-dialog', 'Filtros')
  $('#library-filters').open = true
  $('#library-filters > summary').hidden = true
  filters.append($('#library-filters'))
  filters.append($('#library-count'))
  filters.insertAdjacentHTML('beforeend','<button id="library-filters-apply" class="primary-button">Aplicar filtros</button>')
  $('#library-filters-apply').onclick=()=>filters.close()
  const sources = dialog('library-sources-dialog', 'Carpetas y catálogo')
  for (const selector of ['.library-actions', '#folder-list', '.folder-explanation', '#folder-progress', '#folder-summary', '#read-visible-metadata', '#metadata-progress','#cover-progress']) sources.append($(selector))
  sources.append($('#library-filters .small.muted'))
  const collections = dialog('library-collections-dialog', 'Colecciones')
  collections.append(filters.querySelector('.collection-create'))
  $('#library-controls-placeholder')?.remove()
  const controls = $('.library-controls')
  controls.classList.add('library-toolbar')
  controls.prepend($('#library-search').closest('label'))
  controls.insertAdjacentHTML('beforeend', button('library-filter-toggle','filter','Filtros') + button('library-sources-toggle','open','Carpetas y catálogo') + button('library-collections-toggle','bookmark','Colecciones'))
  for (const element of controls.querySelectorAll('[data-library-view]')) element.id = element.id.replace('library-view-', 'dialog-view-')
  $('#library-content').prepend(controls)
  $('#library-count').classList.add('library-result-count')
  const scroll = document.createElement('div'); scroll.className = 'library-results'
  scroll.append($('#library-list'), $('#library-more')); $('#library-content').append(scroll)
  $('#library-heading-placeholder')?.remove()
  $('.library-heading').innerHTML = `<button id="library-expand" class="text-button library-open-full">${icon('expand')}<span>Abrir biblioteca completa</span></button><div class="library-view-switch" role="group" aria-label="Vista de biblioteca"><button id="library-view-list" data-library-view="list" aria-label="Mostrar títulos" title="Mostrar títulos">${icon('list')}</button><button id="library-view-covers" data-library-view="covers" aria-label="Mostrar portadas" title="Mostrar portadas">${icon('grid')}</button></div>`
  $('#library-tab').insertAdjacentHTML('beforeend','<div id="sidebar-library-list"></div><button id="sidebar-library-more" class="text-button" hidden>Mostrar más</button>')

  const gear = $('#preferences-panel')
  gear.insertAdjacentHTML('afterbegin','<label class="field settings-search"><span class="sr-only">Buscar ajustes</span><input id="settings-search" type="search" placeholder="Buscar ajustes"></label>')
  // Keep the heading first, followed by search.
  gear.prepend(gear.querySelector('.panel-heading'))
  const sections = [...gear.children].filter(node=>node.matches('details'))
  const section=name=>sections.find(element=>element.querySelector('summary')?.textContent.trim()===name)
  const reading=section('Lectura'),appearance=section('Apariencia'),voice=section('Voz')
  const flow = $('[data-setting="readingFlow"]').closest('label')
  flow.firstChild.textContent = 'Formato de lectura'
  flow.querySelector('option[value="scrolled"]').textContent = 'Lectura continua · créditos'
  reading.querySelector('[data-settings-panel]')?.remove()
  appearance.querySelector('[data-settings-panel]')?.remove()
  voice.querySelector('[data-settings-panel]')?.remove()
  const shared = []
  for (const [name, host] of [['appearance',reading],['theme',appearance],['voice',voice]]) {
    const panel = $(`#${name}-panel`)
    const body = document.createElement('div'); body.className = 'shared-settings'
    for (const element of [...panel.children].slice(1)) body.append(element)
    panel.append(body)
    shared.push({body, panel, host})
    if (name === 'appearance') {
      const basic = document.createElement('div')
      for (const selector of ['[data-setting="font"]','[data-setting="fontSize"]','[data-setting="columns"]']) basic.append(body.querySelector(selector).closest('label'))
      basic.append(flow)
      const advanced = document.createElement('details'); advanced.className = 'settings-section'
      advanced.innerHTML = '<summary>Espaciado, márgenes y fuentes</summary>'
      advanced.append(...body.children); body.append(basic, advanced)
    }
    if (name === 'voice') {
      const advanced = document.createElement('details'); advanced.className = 'settings-section'
      advanced.innerHTML = '<summary>Seguimiento y resaltado</summary>'
      for (const selector of ['highlight','highlightMode','followSpeech','clickToRead']) advanced.append(body.querySelector(`[data-setting="${selector}"]`).closest('label'))
      const actions = body.querySelector('.voice-actions'); body.insertBefore(advanced,actions)
    }
  }
  const progress = document.createElement('details'); progress.className='settings-section'
  progress.innerHTML='<summary>Ubicación y tiempo de lectura</summary>'
  progress.append(...[...reading.children].filter(node=>node.tagName!=='SUMMARY')); reading.append(progress)
  // The shared typography body will precede advanced progress controls.
  // Disclosure state belongs to this page session, never to saved preferences.
  for(const detail of document.querySelectorAll('.panel details'))detail.open=false
  const moveSettings = central => {
    for (const {body,panel,host} of shared) (central ? host : panel).append(body)
    if (central) reading.insertBefore(shared[0].body,progress)
  }
  $('#settings-search').addEventListener('input', event=>{
    const query = normalize(event.target.value)
    for (const section of [...gear.children].filter(node=>node.matches('details'))) {
      section.hidden = !!query && !normalize(section.textContent).includes(query)
      if (query && !section.hidden) {
        section.open = true
        for (const detail of section.querySelectorAll('details')) detail.open = true
      }
    }
  })
  return {moveSettings, clearSearch(){ $('#settings-search').value=''; for(const section of [...gear.children].filter(node=>node.matches('details')))section.hidden=false }}
}
