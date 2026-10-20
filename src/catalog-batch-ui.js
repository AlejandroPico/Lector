import {icon} from './icons.js'
import {t,currentLanguage} from './i18n.js'
import {normalize,libraryEntries} from './library.js'
import {planCatalogBatch,batchSignature,patchBatchRecord} from './catalog-batch-core.js'
import {getCatalogBatch,commitCatalogBatch} from './storage.js'
import './catalog-batch.css'

export function createCatalogBatchTools({getItems,getRecords,getCollections,getSources,refresh,toast}){
  const $=selector=>document.querySelector(selector),selected=new Set()
  let selecting=false,filtered=[],plan,undo=false,busy=false,reviewLimit=100,historySequence=0,undoPreview
  const toolbar=$('#library-dialog .library-toolbar')
  toolbar.insertAdjacentHTML('beforeend',`<button id="library-batch-toggle" class="icon-button" title="Organizar varios libros" aria-label="Organizar varios libros" aria-pressed="false">${icon('check')}</button><button id="library-batch-undo" class="icon-button" hidden title="Revisar último lote" aria-label="Revisar último lote">${icon('undo')}</button>`)
  const bar=document.createElement('div');bar.id='batch-selection';bar.hidden=true;bar.innerHTML='<span id="batch-selection-count" class="small"></span><button id="batch-select-results" class="text-button">Seleccionar resultados</button><button id="batch-clear-selection" class="text-button">Vaciar selección</button><button id="batch-open" class="text-button">Organizar selección</button>';toolbar.after(bar)
  const dialog=document.createElement('dialog');dialog.id='catalog-batch-dialog';dialog.className='catalog-batch-dialog';dialog.setAttribute('aria-labelledby','catalog-batch-title')
  dialog.innerHTML=`<div class="panel-heading"><h2 id="catalog-batch-title">Organizar varios libros</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><p class="small muted">Solo cambia el catálogo local. Los archivos, las notas y la lectura permanecen intactos.</p><form id="batch-form">
  <label class="check-field"><input id="batch-use-author" type="checkbox">Autor</label><div data-batch-fields="author" hidden><label class="field">Autor<input id="batch-author" maxlength="400" data-user-content></label></div>
  <label class="check-field"><input id="batch-use-tags" type="checkbox">Etiquetas</label><div data-batch-fields="tags" hidden><label class="field">Acción<select id="batch-tags-mode"><option value="add">Añadir</option><option value="remove">Quitar</option><option value="replace">Sustituir</option></select></label><label class="field">Etiquetas<textarea id="batch-tags" rows="2" maxlength="5000" data-user-content></textarea></label><p class="small muted">Separa las etiquetas con comas o saltos de línea.</p></div>
  <label class="check-field"><input id="batch-use-series" type="checkbox">Serie</label><div data-batch-fields="series" hidden><label class="field">Serie<input id="batch-series" maxlength="160" data-user-content></label><label class="check-field"><input id="batch-number-series" type="checkbox">Numerar por título</label><label id="batch-series-start-field" class="field" hidden>Primer número<input id="batch-series-start" type="number" min="0" max="1000000" step="any" value="1"></label></div>
  <label class="check-field"><input id="batch-use-collections" type="checkbox">Colecciones</label><div data-batch-fields="collections" hidden><label class="field">Acción<select id="batch-collections-mode"><option value="add">Añadir</option><option value="remove">Quitar</option><option value="replace">Sustituir</option></select></label><label class="field">Buscar colecciones<input id="batch-collection-search" type="search"></label><div id="batch-collections"></div></div><button class="primary-button" type="submit">Revisar cambios</button></form>
  <section id="batch-review" hidden><p id="batch-review-count" class="small"></p><label class="field">Buscar libros<input id="batch-review-search" type="search"></label><div id="batch-review-list"></div><button id="batch-review-more" class="text-button" hidden>Mostrar más</button><div class="editor-actions"><button id="batch-back" class="text-button">Volver</button><button id="batch-commit" class="primary-button">Aplicar cambios</button></div></section><p id="batch-message" class="small" role="status"></p>`
  $('#app').append(dialog)
  const text=(label,tag='span',user=false)=>{const node=document.createElement(tag);if(user)node.dataset.userContent='';node.textContent=user?label:t(label);return node}
  function describeError(error){const source=error?.message,known=['Los cambios del lote no son válidos.','Un libro admite hasta 100 etiquetas o colecciones.','Selecciona entre 1 y 10000 libros.','No hay cambios que aplicar.','El catálogo ha cambiado. Revisa de nuevo los cambios antes de continuar.','Estos datos han cambiado después del lote. No se ha deshecho ningún cambio.','Una colección ya no existe. Revisa la selección.'];return t(known.includes(source)?source:'No se pudo guardar el lote.')}
  function message(error){$('#batch-message').textContent=describeError(error)}
  function updateSelection(){
    bar.hidden=!selecting;$('#library-batch-toggle').setAttribute('aria-pressed',String(selecting));$('#library-list').classList.toggle('batch-selecting',selecting)
    $('#batch-selection-count').textContent=`${t('Seleccionados')}: ${selected.size}`;$('#batch-open').disabled=!selected.size;$('#batch-select-results').disabled=!filtered.length
    for(const row of $('#library-list').children){row.classList.toggle('batch-selected',selected.has(row.dataset.libraryItemId));const pick=row.querySelector('.batch-pick');if(pick){pick.hidden=!selecting;pick.querySelector('input').checked=selected.has(row.dataset.libraryItemId)}}
  }
  function toggle(id){selected.has(id)?selected.delete(id):selected.add(id);updateSelection()}
  $('#library-list').addEventListener('click',event=>{const row=event.target.closest('.library-row');if(!selecting||!row||event.target.closest('.batch-pick'))return;event.preventDefault();event.stopImmediatePropagation();toggle(row.dataset.libraryItemId)},true)
  function decorate(items){
    filtered=items
    const available=new Map(getItems().map(item=>[item.id,item]));for(const id of selected)if(!available.has(id))selected.delete(id)
    for(const row of $('#library-list').children){const id=row.dataset.libraryItemId;if(!id)continue
      const label=document.createElement('label');label.className='batch-pick';const input=document.createElement('input');input.type='checkbox';input.setAttribute('aria-label',t('Seleccionar libro')+': '+(available.get(id)?.title??''));input.onchange=()=>toggle(id);label.append(input);row.prepend(label)
    }
    updateSelection()
  }
  async function refreshHistory(){const job=++historySequence;try{const batch=await getCatalogBatch();if(job===historySequence)$('#library-batch-undo').hidden=!batch?.entries?.length}catch{/* Storage errors are reported when the action is requested. */}}
  $('#library-batch-toggle').onclick=()=>{selecting=!selecting;if(!selecting)selected.clear();updateSelection()}
  $('#batch-select-results').onclick=()=>{for(const item of filtered)selected.add(item.id);updateSelection()}
  $('#batch-clear-selection').onclick=()=>{selected.clear();updateSelection()}
  function resetForm(){
    $('#batch-form').reset();for(const element of dialog.querySelectorAll('[data-batch-fields]'))element.hidden=true
    $('#batch-series-start-field').hidden=true;$('#batch-form').hidden=false;$('#batch-review').hidden=true;$('#batch-message').textContent='';plan=undefined;undo=false
    const list=$('#batch-collections');list.replaceChildren()
    for(const collection of getCollections()){const label=document.createElement('label');label.className='check-field';label.dataset.collectionName=normalize(collection.name);const input=document.createElement('input');input.type='checkbox';input.value=collection.id;label.append(input,text(collection.name,'span',true));list.append(label)}
    if(!getCollections().length)list.append(text('Crea una colección para agrupar tus libros.','p'))
    syncFields()
  }
  $('#batch-open').onclick=()=>{resetForm();dialog.showModal()}
  function syncFields(){
    for(const key of ['author','tags','series','collections']){const enabled=$(`#batch-use-${key}`).checked,group=$(`[data-batch-fields="${key}"]`);group.hidden=!enabled;for(const input of group.querySelectorAll('input,select,textarea'))input.disabled=!enabled}
    const number=$('#batch-use-series').checked&&$('#batch-number-series').checked;$('#batch-series-start-field').hidden=!number;$('#batch-series-start').disabled=!number;$('#batch-series-start').required=number
  }
  for(const key of ['author','tags','series','collections'])$(`#batch-use-${key}`).onchange=syncFields
  $('#batch-number-series').onchange=syncFields
  $('#batch-collection-search').oninput=()=>{const query=normalize($('#batch-collection-search').value);for(const label of $('#batch-collections').querySelectorAll('label'))label.hidden=!label.dataset.collectionName.includes(query)}
  const chosen=()=>{
    const collator=new Intl.Collator(currentLanguage(),{numeric:true,sensitivity:'base'})
    return getItems().filter(item=>selected.has(item.id)).sort((a,b)=>collator.compare(a.title,b.title)||collator.compare(a.id,b.id))
  }
  $('#batch-form').onsubmit=async event=>{
    event.preventDefault();if(busy)return;$('#batch-message').textContent=''
    try{
      await refresh();const config={}
      if($('#batch-use-author').checked)config.author=$('#batch-author').value
      if($('#batch-use-tags').checked)config.tags={mode:$('#batch-tags-mode').value,values:$('#batch-tags').value.split(/[,\n]/u).map(value=>value.trim()).filter(Boolean)}
      if($('#batch-use-series').checked)config.series={name:$('#batch-series').value,number:$('#batch-number-series').checked,start:Number($('#batch-series-start').value)}
      if($('#batch-use-collections').checked)config.collections={mode:$('#batch-collections-mode').value,values:[...$('#batch-collections').querySelectorAll('input:checked')].map(input=>input.value)}
      plan=planCatalogBatch(chosen(),getRecords(),config);if(!plan.entries.length)throw Error('No hay cambios que aplicar.')
      undo=false;showReview()
    }catch(error){message(error)}
  }
  function display(value,collections=false){if(value===null||value===undefined||value===''||Array.isArray(value)&&!value.length)return t('Sin valor');if(Array.isArray(value))return value.map(id=>collections?getCollections().find(item=>item.id===id)?.name??id:id).join(', ');return String(value)}
  function renderReview(){
    const list=$('#batch-review-list');list.replaceChildren();const query=normalize($('#batch-review-search').value),items=plan.entries.filter(entry=>!query||normalize(entry.title).includes(query)),shown=items.slice(0,reviewLimit)
    const labels={author:'Autor',tags:'Etiquetas',series:'Serie',seriesIndex:'Número en la serie',collections:'Colecciones'}
    for(const entry of shown){const section=document.createElement('section');section.className='batch-review-entry';section.append(text(entry.title,'h3',true))
      for(const field of entry.fields){const row=document.createElement('p'),from=undo?field.to:field.from,to=undo?field.from:field.to;row.append(text(t(labels[field.path.split('.').at(-1)])+': '),text(display(from,field.path==='collections'),'del',true),text(' → '),text(display(to,field.path==='collections'),'ins',true));section.append(row)}
      list.append(section)
    }
    $('#batch-review-count').textContent=`${t('Libros con cambios')}: ${plan.entries.length} · ${shown.length} / ${items.length}`;$('#batch-review-more').hidden=shown.length>=items.length
  }
  function showReview(){reviewLimit=100;$('#batch-review-search').value='';$('#batch-form').hidden=true;$('#batch-review').hidden=false;$('#batch-commit').textContent=t(undo?'Deshacer cambios':'Aplicar cambios');$('#batch-message').textContent='';renderReview()}
  function projectUndo(batch){
    const records=new Map(getRecords().map(record=>[record.id,record]))
    for(const entry of batch.entries)records.set(entry.id,{...patchBatchRecord(records.get(entry.id),entry.fields,'before'),id:entry.id})
    const {books,folders}=getSources(),after=new Map(libraryEntries(books,folders,[...records.values()]).map(item=>[item.id,item])),before=new Map(getItems().map(item=>[item.id,item]))
    return batch.entries.map(entry=>{if(!before.has(entry.id)||!after.has(entry.id))throw Error('El catálogo ha cambiado. Revisa de nuevo los cambios antes de continuar.');return {...entry,fields:entry.fields.map(field=>{const key=field.path.split('.').at(-1);return {...field,from:after.get(entry.id)[key],to:before.get(entry.id)[key]}})}})
  }
  const undoSignature=entries=>JSON.stringify(entries.map(entry=>[entry.id,entry.fields.map(field=>[field.path,field.from,field.to])]))
  $('#batch-review-search').oninput=()=>{reviewLimit=100;renderReview()};$('#batch-review-more').onclick=()=>{reviewLimit+=100;renderReview()}
  $('#batch-back').onclick=()=>{if(undo)dialog.close();else{$('#batch-form').hidden=false;$('#batch-review').hidden=true;plan=undefined;$('#batch-message').textContent=''}}
  $('#library-batch-undo').onclick=async()=>{try{await refresh();plan=await getCatalogBatch();if(!plan?.entries.length)throw Error('No hay cambios que aplicar.');plan={...plan,entries:projectUndo(plan)};undoPreview=undoSignature(plan.entries);undo=true;showReview();dialog.showModal()}catch(error){toast(describeError(error))}}
  $('#batch-commit').onclick=async()=>{
    if(busy||!plan)return;busy=true;$('#batch-commit').disabled=true;dialog.querySelector('.dialog-close').disabled=true;$('#batch-message').textContent=''
    try{
      await refresh()
      if(undo){if(undoSignature(projectUndo(plan))!==undoPreview)throw Error('El catálogo ha cambiado. Revisa de nuevo los cambios antes de continuar.')}
      else{const current=new Map(getItems().map(item=>[item.id,item]));if(plan.entries.some(entry=>!current.has(entry.id)||batchSignature(current.get(entry.id))!==entry.signature))throw Error('El catálogo ha cambiado. Revisa de nuevo los cambios antes de continuar.')}
      await commitCatalogBatch(plan,{undo});dialog.close();selected.clear();selecting=false;await refresh();await refreshHistory();toast(undo?'Cambios deshechos':'Organización guardada')
    }catch(error){message(error)}finally{busy=false;$('#batch-commit').disabled=false;dialog.querySelector('.dialog-close').disabled=false}
  }
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault()})
  dialog.addEventListener('click',event=>{if(busy){event.preventDefault();event.stopImmediatePropagation()}},true)
  refreshHistory()
  return {decorate,refresh:refreshHistory}
}
