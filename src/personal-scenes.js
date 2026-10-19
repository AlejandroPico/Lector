import {allScenes,saveScene,removeScene} from './storage.js'
import {prepareScenePhoto,isPersonalScene} from './personal-scene-core.js'
import {icon} from './icons.js'
import {t} from './i18n.js'

export function createPersonalScenes({settings,closePanels,onError}){
  const $=selector=>document.querySelector(selector),resources=new Map(),thumbs=new Map()
  let currentURL,currentID,draft,draftURL,sequence=0,loading=false,saving=false,loaded=false
  $('#scene-options').insertAdjacentHTML('afterend','<div id="personal-scene-actions" hidden><button id="personal-scenes-open" class="settings-link">Mis escenarios</button></div>')
  const dialog=document.createElement('dialog');dialog.id='personal-scenes-dialog';dialog.className='small-dialog';dialog.setAttribute('aria-labelledby','personal-scenes-title')
  dialog.innerHTML=`<div class="panel-heading"><h2 id="personal-scenes-title">Mis escenarios</h2><button id="personal-scenes-close" class="icon-button" aria-label="Cerrar">${icon('close')}</button></div><p class="small muted">Tus fotografías se guardan en este navegador o aplicación. No se suben ni se sincronizan.</p><label class="field">Escenario<select id="personal-scene-select"></select></label><button id="personal-scene-add" class="text-button">Añadir fotografía</button><input id="personal-scene-file" type="file" accept="image/png,image/jpeg,image/webp" hidden><img id="personal-scene-preview" alt="" hidden><label class="field">Nombre<input id="personal-scene-name" maxlength="48" data-user-content></label><label class="field">Contraste de los controles<select id="personal-scene-contrast"><option value="auto">Automático</option><option value="light">Controles claros</option><option value="dark">Controles oscuros</option></select></label><div class="editor-actions"><button id="personal-scene-save" class="primary-button">Guardar y usar</button><button id="personal-scene-delete" class="text-button">Eliminar escenario</button></div><p id="personal-scene-status" class="small muted" role="status"></p>`
  $('#app').append(dialog)
  const choose=id=>{const select=$('[data-setting="bookScene"]');select.value=id;select.dispatchEvent(new Event('input',{bubbles:true}))}
  function busy(){for(const id of ['select','add','name','contrast','save','delete'])$(`#personal-scene-${id}`).disabled=loading||saving;$('#personal-scene-save').disabled=loading||saving||!draft;$('#personal-scene-delete').hidden=!draft?.id}
  function clearPreview(){if(draftURL)URL.revokeObjectURL(draftURL);draftURL=undefined;$('#personal-scene-preview').removeAttribute('src');$('#personal-scene-preview').hidden=true}
  function edit(resource){
    clearPreview();draft=resource?{...resource}:undefined
    $('#personal-scene-name').value=draft?.name??'';$('#personal-scene-contrast').value=draft?.contrast??'auto'
    if(draft){draftURL=URL.createObjectURL(draft.thumbnail??draft.image);$('#personal-scene-preview').src=draftURL;$('#personal-scene-preview').hidden=false}
    busy()
  }
  function render(){
    for(const element of document.querySelectorAll('[data-personal-scene]'))element.remove()
    const select=$('[data-setting="bookScene"]'),picker=$('#scene-options'),manager=$('#personal-scene-select'),previous=manager.value
    manager.replaceChildren(new Option(t('Nueva fotografía'),''))
    for(const resource of resources.values()){
      if(!thumbs.has(resource.id))thumbs.set(resource.id,URL.createObjectURL(resource.thumbnail??resource.image))
      const option=new Option(resource.name,resource.id);option.dataset.personalScene='';option.dataset.userContent='';select.append(option)
      const own=new Option(resource.name,resource.id);own.dataset.userContent='';manager.append(own)
      const button=document.createElement('button');button.type='button';button.className='scene-option';button.dataset.scene=resource.id;button.dataset.personalScene='';button.dataset.sceneLabel=resource.name;button.dataset.userContent='';button.title=resource.name
      const image=document.createElement('span');image.className='scene-thumbnail';image.style.backgroundImage=`url("${thumbs.get(resource.id)}")`;image.setAttribute('aria-hidden','true')
      const label=document.createElement('span');label.textContent=resource.name;button.append(image,label);button.onclick=()=>choose(resource.id);picker.append(button)
    }
    manager.value=resources.has(previous)?previous:''
    select.value=settings.bookScene
  }
  function apply(){
    $('#personal-scene-actions').hidden=settings.appearance!=='book'
    const background=$('#book-environment'),resource=resources.get(settings.bookScene)
    if(resource&&settings.appearance==='book'){
      if(currentID!==resource.id){if(currentURL)URL.revokeObjectURL(currentURL);currentURL=URL.createObjectURL(resource.image);currentID=resource.id}
      background.style.backgroundImage=`url("${currentURL}")`
      const darkInk=resource.contrast==='dark'||resource.contrast==='auto'&&resource.bright
      document.body.style.setProperty('--desk-ink',darkInk?'#27231e':'#fff4df');document.body.style.setProperty('--desk-shadow',darkInk?'#fff4dd':'#160b04')
    }else{
      background.style.removeProperty('background-image');document.body.style.removeProperty('--desk-ink');document.body.style.removeProperty('--desk-shadow')
      if(currentURL)URL.revokeObjectURL(currentURL);currentURL=currentID=undefined
    }
  }
  $('#personal-scenes-open').onclick=()=>{closePanels();render();const id=resources.has(settings.bookScene)?settings.bookScene:'';$('#personal-scene-select').value=id;edit(resources.get(id));$('#personal-scene-status').textContent='';dialog.showModal()}
  $('#personal-scenes-close').onclick=()=>dialog.close()
  dialog.addEventListener('close',()=>{sequence++;loading=false;clearPreview();draft=undefined;busy()})
  $('#personal-scene-select').onchange=()=>edit(resources.get($('#personal-scene-select').value))
  $('#personal-scene-add').onclick=()=>$('#personal-scene-file').click()
  $('#personal-scene-file').onchange=async()=>{
    const file=$('#personal-scene-file').files[0];$('#personal-scene-file').value='';if(!file)return
    const run=++sequence;loading=true;busy();$('#personal-scene-status').textContent=t('Preparando fotografía…')
    try{const photo=await prepareScenePhoto(file);if(run!==sequence||!dialog.open)return;$('#personal-scene-select').value='';edit({...photo,name:file.name.replace(/\.[^.]+$/,'').slice(0,48),contrast:'auto'});$('#personal-scene-status').textContent=''}
    catch(error){if(run===sequence)$('#personal-scene-status').textContent=t(error.message)}
    finally{if(run===sequence){loading=false;busy()}}
  }
  $('#personal-scene-save').onclick=async()=>{
    if(!draft||saving||loading)return
    const name=$('#personal-scene-name').value.trim();if(!name){$('#personal-scene-status').textContent=t('Escribe un nombre para el escenario.');return}
    const resource={...draft,id:draft.id??`photo-${crypto.randomUUID()}`,name,contrast:$('#personal-scene-contrast').value,updatedAt:Date.now()};saving=true;busy()
    try{await saveScene(resource);resources.set(resource.id,resource);render();choose(resource.id);dialog.close()}
    catch{onError(new Error('No se pudo guardar el escenario. Revisa el espacio disponible.'))}finally{saving=false;busy()}
  }
  $('#personal-scene-delete').onclick=async()=>{
    if(!draft?.id||saving)return
    const id=draft.id;saving=true;busy()
    try{await removeScene(id);resources.delete(id);if(thumbs.has(id))URL.revokeObjectURL(thumbs.get(id));thumbs.delete(id);render();edit();if(settings.bookScene===id)choose('auto')}
    catch(error){onError(error)}finally{saving=false;busy()}
  }
  const ready=allScenes().then(items=>{
    for(const item of items)if(isPersonalScene(item.id)&&item.image instanceof Blob&&typeof item.name==='string')resources.set(item.id,item)
    loaded=true;render();if(isPersonalScene(settings.bookScene)&&!resources.has(settings.bookScene))choose('auto');apply()
  }).catch(error=>{loaded=true;onError(error)})
  window.addEventListener('pagehide',()=>{clearPreview();if(currentURL)URL.revokeObjectURL(currentURL);for(const url of thumbs.values())URL.revokeObjectURL(url);thumbs.clear();currentID=currentURL=undefined})
  window.addEventListener('pageshow',event=>{if(event.persisted&&loaded){render();apply()}})
  return {ready,apply}
}
