import {icon} from './icons.js'
import {t,currentLanguage} from './i18n.js'
import {saveCollection,removeCollection,updateCatalog,writeJSON} from './storage.js'
import {normalize} from './library.js'
const $=selector=>document.querySelector(selector)

export function addLibraryPolish(settings){
  const dialog=$('#library-collections-dialog')
  dialog.classList.add('collection-manager')
  dialog.insertAdjacentHTML('beforeend',`<div id="collection-list"></div><section id="collection-editor" hidden><div class="collection-editor-heading"><button id="collection-back" class="icon-button" aria-label="Volver">${icon('left')}</button><input id="collection-rename" maxlength="80" aria-label="Nombre de colección"><button id="collection-save-name" class="icon-button" aria-label="Guardar nombre">${icon('check')}</button></div><div class="collection-tools"><button id="collection-open" class="text-button">Ver libros</button><button id="collection-members-toggle" class="text-button">Editar libros</button><button id="collection-remove" class="icon-button" aria-label="Eliminar colección">${icon('trash')}</button></div><div id="collection-members" hidden><label class="field">Buscar libros<input id="collection-member-search" type="search"></label><div id="collection-member-list"></div><button id="collection-save-members" class="primary-button">Guardar selección</button></div><div id="collection-preview"></div></section>`)
  $('#collection-delete').remove()
  if(!globalThis.lectorDesktop){const hint=document.createElement('p');hint.className='small muted';hint.textContent='El navegador no facilita la ruta completa. Puedes escribirla como referencia.';$('#folder-list').after(hint)}
  $('#theme-panel .shared-settings').insertAdjacentHTML('afterbegin','<button id="book-scene-shortcut" class="settings-link" hidden>Entorno del libro</button>')
  for(const button of document.querySelectorAll('[data-library-view="covers"]')){
    const wrap=document.createElement('div');wrap.className='cover-size-control';button.replaceWith(wrap);wrap.append(button)
    const popup=document.createElement('div');popup.className='cover-size-popup';popup.innerHTML=`<label>Tamaño de portadas<input type="range" min="100" max="280" step="5" value="${settings.coverSize}" aria-label="Tamaño de portadas"></label>`;wrap.append(popup)
    popup.querySelector('input').oninput=event=>{settings.coverSize=Number(event.target.value);document.documentElement.style.setProperty('--cover-size',settings.coverSize+'px');writeJSON('lector-settings',settings)}
    button.addEventListener('click',()=>{wrap.classList.toggle('size-open');for(const other of document.querySelectorAll('.cover-size-control'))if(other!==wrap)other.classList.remove('size-open')})
  }
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('.cover-size-control'))for(const wrap of document.querySelectorAll('.cover-size-control'))wrap.classList.remove('size-open')})
  document.documentElement.style.setProperty('--cover-size',settings.coverSize+'px')
}

export function createLibraryPolish({getItems,getCollections,refresh,attempt,openLibrary,openItem}){
  let selectedID,selectedMembers=new Set(),editingMembers=false
  const selected=()=>getCollections().find(item=>item.id===selectedID)
  const members=()=>getItems().filter(item=>item.collections.includes(selectedID))
  const button=(label,action,kind='text-button')=>{const el=document.createElement('button');el.className=kind;el.textContent=label;el.onclick=attempt(action);return el}
  function renderMembers(){
    const query=normalize($('#collection-member-search').value),list=$('#collection-member-list');list.replaceChildren()
    const items=getItems().filter(item=>!query||normalize(item.title+' '+item.author).includes(query)).sort((a,b)=>a.title.localeCompare(b.title,currentLanguage()))
    // Search keeps this panel usable with large catalogues; selections outlive it.
    for(const item of items.slice(0,250)){
      const label=document.createElement('label');label.className='check-field';const input=document.createElement('input');input.type='checkbox';input.checked=selectedMembers.has(item.id);input.onchange=()=>input.checked?selectedMembers.add(item.id):selectedMembers.delete(item.id)
      const text=document.createElement('span');text.dataset.userContent='';text.textContent=[item.title,item.author].filter(Boolean).join(' · ');label.append(input,text);list.append(label)
    }
    if(items.length>250){const message=document.createElement('p');message.className='small muted';message.textContent=t('Busca para mostrar otros libros.');list.append(message)}
  }
  function render(){
    const collection=selected();$('#collection-editor').hidden=!collection;$('#collection-list').hidden=Boolean(collection);$('#library-collections-dialog .collection-create').hidden=Boolean(collection)
    if(collection){
      if(document.activeElement!==$('#collection-rename'))$('#collection-rename').value=collection.name
      $('#collection-members').hidden=!editingMembers;$('#collection-preview').hidden=editingMembers
      const preview=$('#collection-preview');preview.replaceChildren()
      for(const item of members()) {const entry=button(item.title,()=>openItem(item));entry.dataset.userContent='';preview.append(entry)}
      if(!members().length){const empty=document.createElement('p');empty.className='small muted';empty.textContent=t('Todavía no hay libros en esta colección.');preview.append(empty)}
      if(editingMembers)renderMembers()
      return
    }
    const list=$('#collection-list');list.replaceChildren()
    for(const item of [...getCollections()].sort((a,b)=>a.name.localeCompare(b.name,currentLanguage()))){
      const row=document.createElement('div');row.className='collection-row'
      const open=button(item.name,()=>{$('#filter-collection').value=item.id;$('#library-collections-dialog').close();openLibrary();refresh()});open.dataset.userContent=''
      const count=document.createElement('span');count.className='small muted';count.textContent=String(getItems().filter(book=>book.collections.includes(item.id)).length)
      const edit=document.createElement('button');edit.className='icon-button';edit.innerHTML=icon('settings');edit.setAttribute('aria-label',t('Editar colección')+': '+item.name);edit.onclick=()=>{selectedID=item.id;editingMembers=false;render()}
      row.append(open,count,edit);list.append(row)
    }
    if(!getCollections().length){const empty=document.createElement('p');empty.className='small muted';empty.textContent=t('Crea una colección para agrupar tus libros.');list.append(empty)}
  }
  $('#library-collections-dialog').addEventListener('close',()=>{selectedID=undefined;editingMembers=false})
  $('#collection-back').onclick=()=>{selectedID=undefined;editingMembers=false;render()}
  $('#collection-open').onclick=()=>{if(!selected())return;$('#filter-collection').value=selectedID;$('#library-collections-dialog').close();openLibrary();refresh()}
  $('#collection-save-name').onclick=attempt(async()=>{const name=$('#collection-rename').value.trim();if(!name)return;if(getCollections().some(item=>item.id!==selectedID&&normalize(item.name)===normalize(name)))throw Error(t('Esta colección ya existe.'));await saveCollection({...selected(),name,updatedAt:Date.now()});await refresh()})
  $('#collection-remove').onclick=attempt(async()=>{if(!selected())return;await removeCollection(selectedID);selectedID=undefined;editingMembers=false;await refresh()})
  $('#collection-members-toggle').onclick=()=>{editingMembers=!editingMembers;if(editingMembers){selectedMembers=new Set(members().map(item=>item.id));$('#collection-member-search').value=''}render()}
  $('#collection-member-search').oninput=renderMembers
  $('#collection-save-members').onclick=attempt(async()=>{for(const item of getItems()){const before=item.collections.includes(selectedID),after=selectedMembers.has(item.id);if(before!==after)await updateCatalog(item.id,state=>({...state,collections:after?[...new Set([...(state.collections??[]),selectedID])]:(state.collections??[]).filter(id=>id!==selectedID),updatedAt:Date.now()}))}editingMembers=false;await refresh()})
  return {refresh:render}
}
