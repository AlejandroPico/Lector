import {icon} from './icons.js'
import {t} from './i18n.js'
import {allBooks,saveBook,getSyncData,saveSyncData,readJSON,writeJSON} from './storage.js'
import {snapshot,safeSync,mergeSnapshots,positionConflicts,applyPortable} from './sync-core.js'
import {WebDAVSync,OneDriveSync,oneDriveLogin,syncURL} from './sync-services.js'
export function addSyncMenus(){
 const section=[...document.querySelectorAll('#preferences-panel > details')].find(section=>section.querySelector('summary').textContent==='Datos')
 section.insertAdjacentHTML('beforeend','<button id="settings-sync" class="settings-link">Sincronizar dispositivos</button>')
 document.querySelector('#app').insertAdjacentHTML('beforeend',`<dialog id="sync-dialog" class="small-dialog" aria-labelledby="sync-title"><div class="panel-heading"><h2 id="sync-title">Sincronizar dispositivos</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div>
 <label class="field">Servicio de sincronización<select id="sync-provider"><option value="none">Desactivada</option><option value="onedrive">OneDrive</option><option value="webdav">WebDAV · servidor personal</option></select></label>
 <div id="sync-onedrive" hidden><label class="field">Aplicación Microsoft (ID público)<input id="sync-client" placeholder="00000000-0000-0000-0000-000000000000" autocomplete="off" maxlength="36"></label><button id="sync-login" class="text-button">Iniciar sesión en OneDrive</button><p class="small muted">Requiere registrar Lector como aplicación web en Microsoft. Solo accede a su carpeta de aplicación.</p></div>
 <div id="sync-webdav" hidden><label class="field">Dirección del archivo de sincronización<input id="sync-url" type="url" placeholder="https://servidor/carpeta/lector.json" maxlength="1000"></label><label class="field">Usuario<input id="sync-user" autocomplete="off" maxlength="200"></label><label class="field">Contraseña de aplicación<input id="sync-password" type="password" autocomplete="off" maxlength="1000"></label></div>
 <fieldset id="sync-options"><legend>Datos que quieres sincronizar</legend><label class="check-field"><input id="sync-positions" type="checkbox" checked>Posiciones de lectura</label><label class="check-field"><input id="sync-notes" type="checkbox" checked>Notas y subrayados</label><label class="check-field"><input id="sync-preferences" type="checkbox">Preferencias de lectura</label></fieldset>
 <p class="small muted">Los libros, audios, fuentes y claves no se suben. Solo sincroniza al pulsar el botón. Las credenciales duran esta sesión.</p><a class="text-link" href="https://github.com/AlejandroPico/Lector/blob/main/SINCRONIZACION.md" target="_blank" rel="noopener noreferrer">Guía de sincronización</a>
 <div class="editor-actions"><button id="sync-prepare" class="primary-button" disabled>Revisar sincronización</button><button id="sync-disconnect" class="text-button">Desconectar</button></div><p id="sync-status" role="status"></p><div id="sync-review" hidden><p class="small muted">Elige la posición en conflicto. Las notas se reúnen; las ediciones más recientes y eliminaciones se conservan.</p><div id="sync-conflicts"></div><label id="sync-preference-choice-field" class="field" hidden>Preferencias que se conservarán<select id="sync-preference-choice"><option value="local">Este dispositivo</option><option value="remote">Otros dispositivos</option></select></label><button id="sync-apply" class="primary-button">Confirmar sincronización</button></div><button id="sync-cancel" class="text-button" hidden>Cancelar</button></dialog>`)
}
export async function restoreSyncedBook(id,saved){
 const pending=await getSyncData('approved').catch(()=>null),portable=pending?.data?.books.find(book=>book.id===id)
 if(!portable)return saved
 const current=saved??{id,notes:[]},options={...pending.options,positions:pending.options.positions&&(!current.positionUpdatedAt||portable.position?.updatedAt>current.positionUpdatedAt)}
 return applyPortable(current,portable,options)
}
export function createSyncTools({getRecord,getSettings,saveCurrent,applyCurrent,applyPreferences,closePanels,onError}){
 const $=id=>document.getElementById(id),config=readJSON('lector-sync-config',{});let service,abort,review,working=false,releaseLock
 const device=readJSON('lector-device-id',null)??crypto.randomUUID();writeJSON('lector-device-id',device)
 $('sync-provider').value=['onedrive','webdav'].includes(config.provider)?config.provider:'none';$('sync-client').value=config.client??import.meta.env.VITE_MICROSOFT_CLIENT_ID??'';$('sync-url').value=config.url??''
 for(const key of ['positions','notes','preferences'])if(typeof config[key]==='boolean')$('sync-'+key).checked=config[key]
 const options=()=>Object.fromEntries(['positions','notes','preferences'].map(key=>[key,$('sync-'+key).checked]))
 const status=text=>$('sync-status').textContent=t(text)
 const safe=fn=>async()=>{try{await fn()}catch(error){status(error.name==='AbortError'?'Sincronización cancelada':error.message);if(error.name!=='AbortError')onError(error)}}
 function refresh(){const provider=$('sync-provider').value;$('sync-onedrive').hidden=provider!=='onedrive';$('sync-webdav').hidden=provider!=='webdav';$('sync-prepare').disabled=working||provider==='none'||provider==='onedrive'&&!service;status(service?'Conexión disponible en esta sesión.':'Sincronización desactivada hasta que la solicites.')}
 const release=()=>{releaseLock?.();releaseLock=null}
 async function lock(){release();if(!navigator.locks)return;await new Promise((resolve,reject)=>{navigator.locks.request('lector-synchronization',{ifAvailable:true},value=>{if(!value){reject(new Error(t('Otra pestaña está sincronizando.')));return}return new Promise(done=>{releaseLock=done;resolve()})}).catch(reject)})}
 function forget(){abort?.abort();abort=null;release();service?.disconnect();service=null;review=null;$('sync-review').hidden=true;$('sync-password').value='';$('sync-user').value='';refresh()}
 async function localData(selected){await saveCurrent();let books=await allBooks();const current=getRecord();if(current)books=[current,...books.filter(book=>book.id!==current.id)];return snapshot(books,getSettings(),selected)}
 function remember(){let url='';try{url=syncURL($('sync-url').value.trim())}catch{}const client=$('sync-client').value.trim();writeJSON('lector-sync-config',{provider:$('sync-provider').value,client:/^[a-f\d]{8}-([a-f\d]{4}-){3}[a-f\d]{12}$/i.test(client)?client:'',url,...options()})}
 function freeze(value){working=value;$('sync-provider').disabled=value;$('sync-options').disabled=value;$('sync-prepare').disabled=value||$('sync-provider').value==='none'||$('sync-provider').value==='onedrive'&&!service;$('sync-apply').disabled=value;$('sync-cancel').hidden=!value;for(const id of ['sync-client','sync-url','sync-user','sync-password','sync-login'])$(id).disabled=value}
 $('settings-sync').onclick=()=>{closePanels();$('sync-dialog').showModal();refresh()}
 $('sync-provider').onchange=()=>{forget();remember()}
 for(const id of ['sync-client','sync-url','sync-user','sync-password'])$(id).onchange=()=>{release();service?.disconnect();service=null;review=null;$('sync-review').hidden=true;if(id==='sync-url'){$('sync-password').value='';$('sync-user').value=''}remember();refresh()}
 for(const id of ['sync-positions','sync-notes','sync-preferences'])$(id).onchange=()=>{release();review=null;$('sync-review').hidden=true;remember();refresh()}
 $('sync-disconnect').onclick=()=>{forget();$('sync-provider').value='none';remember();refresh()}
 $('sync-cancel').onclick=()=>{abort?.abort();release();review=null;$('sync-review').hidden=true}
 $('sync-login').onclick=safe(async()=>{abort=new AbortController();freeze(true);try{const login=await oneDriveLogin($('sync-client').value.trim(),abort.signal);service=new OneDriveSync(login.token,login.expires,device);remember()}finally{abort=null;freeze(false);refresh()}})
 $('sync-prepare').onclick=safe(async()=>{
  if(working)return
  const selected=options();if(!Object.values(selected).some(Boolean))throw new Error(t('Selecciona algún dato para sincronizar.'))
  if($('sync-provider').value==='webdav'){service?.disconnect();service=new WebDAVSync(syncURL($('sync-url').value.trim()),$('sync-user').value,$('sync-password').value)}
  if(!service)throw new Error(t('Vuelve a iniciar sesión en OneDrive.'))
  const controller=abort=new AbortController(),transport=service;freeze(true);review=null;$('sync-review').hidden=true
  try{
   await lock();controller.signal.throwIfAborted();status('Revisando datos remotos…');const local=await localData(selected);controller.signal.throwIfAborted();const remote=await transport.read(controller.signal);controller.signal.throwIfAborted();review={local,remote,selected,service:transport}
   $('sync-conflicts').replaceChildren()
   for(const item of selected.positions?positionConflicts(local,remote.data):[]){
    const label=document.createElement('label');label.className='field';const name=document.createElement('span');name.dataset.userContent='';name.textContent=item.title;const select=document.createElement('select');select.dataset.bookId=item.id
    select.add(new Option(`${t('Este dispositivo')} · ${Math.round(item.local.fraction*100)} %`,'local'));select.add(new Option(`${t('Otros dispositivos')} · ${Math.round(item.remote.fraction*100)} %`,'remote'));label.append(name,select);$('sync-conflicts').append(label)
   }
   $('sync-preference-choice-field').hidden=!selected.preferences||!Object.keys(remote.data.preferences).length;$('sync-preference-choice').value='local';$('sync-review').hidden=false;status('Revisión lista. Confirma para compartir los datos elegidos.');remember()
  }finally{if(!review)release();if(abort===controller)abort=null;freeze(false)}
 })
 $('sync-apply').onclick=safe(async()=>{
  if(!review||review.service!==service)return
  const prepared=review,controller=abort=new AbortController(),transport=service;freeze(true)
  try{
   // Re-read local state after the preview: edits made during the review survive.
   const local=await localData(prepared.selected);controller.signal.throwIfAborted();const choices=Object.fromEntries([...document.querySelectorAll('#sync-conflicts select')].map(select=>[select.dataset.bookId,select.value]))
   const known=new Set(Object.keys(choices));if(prepared.selected.positions&&positionConflicts(local,prepared.remote.data).some(conflict=>!known.has(conflict.id)))throw new Error(t('La lectura ha cambiado. Revisa de nuevo antes de sincronizar.'))
   const merged=mergeSnapshots(local,prepared.remote.data,choices)
   if(prepared.selected.preferences)merged.preferences=$('sync-preference-choice').value==='remote'?prepared.remote.data.preferences:local.preferences
   // A decision about an older position must propagate as a new decision.
   for(const book of merged.books)if(choices[book.id]&&book.position)book.position.updatedAt=Date.now()
   status('Sincronizando…');await transport.write(merged,prepared.remote.etag,controller.signal);controller.signal.throwIfAborted()
   await saveSyncData({id:'approved',data:merged,options:prepared.selected})
   const current=getRecord(),records=await allBooks()
   for(const record of records){const data=merged.books.find(book=>book.id===record.id);if(!data||record.id===current?.id)continue;await saveBook(applyPortable(record,data,prepared.selected))}
   const activeData=merged.books.find(book=>book.id===current?.id);if(activeData)await applyCurrent(activeData,prepared.selected)
   if(prepared.selected.preferences)await applyPreferences(merged.preferences)
   review=null;$('sync-review').hidden=true;status('Sincronización completada. Los libros nuevos se vinculan al abrir el mismo archivo.')
  }finally{release();if(abort===controller)abort=null;freeze(false)}
 })
 // Closing the dialog cancels pending network operations, not the reading voice.
 $('sync-dialog').addEventListener('close',()=>{abort?.abort();release();review=null;$('sync-review').hidden=true})
 refresh();return {disconnect:forget}
}
