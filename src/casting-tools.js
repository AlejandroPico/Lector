import {icon} from './icons.js'
import {t,currentLanguage} from './i18n.js'
import {allAudioChapters,readJSON,writeJSON} from './storage.js'
import {bridgeURL,safePresentation,CastSender,DEFAULT_RECEIVER} from './casting.js'
export function addCastingMenus(){
 const section=document.querySelector('#settings-fullscreen').closest('details')
 section.querySelector('summary').insertAdjacentHTML('afterend','<button id="settings-casting" class="settings-link">Emitir lectura</button>')
 document.querySelector('#app').insertAdjacentHTML('beforeend',`<dialog id="casting-dialog" class="small-dialog" aria-labelledby="casting-title"><div class="panel-heading"><h2 id="casting-title">Emitir lectura</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div>
 <label class="field">Audio guardado<select id="cast-audio" data-user-content></select></label><label class="text-button">Elegir archivo de audio<input id="cast-file" type="file" accept=".wav,.mp3,.ogg,.flac,.m4a" hidden></label><p id="cast-file-name" data-user-content></p><button id="cast-generate" class="text-button">Audio por capítulos</button>
 <label class="field">Destino de emisión<select id="cast-target"><option value="browser">Receptor en navegador</option><option value="google">Google Cast · solo audio</option><option value="custom">Google Cast · interfaz Lector</option></select></label>
 <label id="cast-app-field" class="field" hidden>Identificador del receptor Cast<input id="cast-app" maxlength="8" placeholder="1234ABCD" autocomplete="off"></label>
 <label class="check-field"><input id="cast-text" type="checkbox">Compartir texto sincronizado</label><p class="small muted">La sincronización de texto usa fragmentos, no palabras. Las voces del navegador no producen audio emitible.</p>
 <details class="settings-section"><summary>Conexión de dispositivos</summary><label class="field">Servicio local de emisión<input id="cast-bridge" value="http://127.0.0.1:5056" inputmode="url"></label><label class="field">Caducidad de la emisión (min)<input id="cast-minutes" type="number" value="120" min="5" max="360"></label><p class="small muted">Inicia el servicio de emision-local con --red y conecta los dispositivos a la misma red. El receptor propio de Google requiere un identificador registrado.</p><a class="text-link" href="https://github.com/AlejandroPico/Lector/blob/main/emision-local/README.md" target="_blank" rel="noopener noreferrer">Guía de emisión</a></details>
 <button id="cast-start" class="primary-button">Iniciar emisión</button><p id="cast-status" role="status"></p><div id="cast-controls" hidden><a id="cast-link" class="text-link" target="_blank" rel="noopener noreferrer">Abrir receptor</a><button id="cast-copy" class="text-button">Copiar enlace</button><div class="editor-actions"><button id="cast-play" class="text-button">Reproducir</button><button id="cast-pause" class="text-button">Pausar</button><button id="cast-stop" class="text-button">Detener emisión</button></div><label class="field">Ir al segundo<input id="cast-seconds" type="number" min="0" value="0"></label><button id="cast-seek" class="text-button">Ir</button></div></dialog>`)
}
export function createCastingTools({closePanels,onError}){
 const $=id=>document.getElementById(id),sender=new CastSender();let items=[],file,session,endpoint,abort,working=false
 const saved=readJSON('lector-casting',{});$('cast-bridge').value=saved.bridge??'http://127.0.0.1:5056';$('cast-app').value=saved.appId??''
 const status=text=>$('cast-status').textContent=t(text)
 const request=async(path,options={})=>{const response=await fetch(endpoint+path,{...options,signal:abort?.signal});if(!response.ok)throw new Error(t('No se pudo conectar con el servicio de emisión.'));return response.json()}
 const safe=fn=>async()=>{try{await fn()}catch(error){status(error.name==='AbortError'?'Emisión cancelada':error.message);if(error.name!=='AbortError')onError(error)}}
 const stop=async()=>{
  abort?.abort();abort=null;sender.disconnect()
  if(session){const previous=session;session=null;try{await request(`/session/${previous.token}`,{method:'DELETE'})}finally{$('cast-controls').hidden=true;$('cast-link').removeAttribute('href');status('Emisión detenida')}}
 }
 $('settings-casting').onclick=safe(async()=>{closePanels();items=(await allAudioChapters()).sort((a,b)=>b.createdAt-a.createdAt);$('cast-audio').replaceChildren(new Option(t('Elige un audio'),''),...items.map(item=>new Option(`${item.bookTitle} · ${item.label}`,item.id)));$('casting-dialog').showModal()})
 $('cast-file').onchange=()=>{file=$('cast-file').files[0];$('cast-file-name').textContent=file?.name??'';if(file)$('cast-audio').value=''}
 $('cast-audio').onchange=()=>{file=null;$('cast-file').value='';$('cast-file-name').textContent=''}
 $('cast-target').onchange=()=>{$('cast-app-field').hidden=$('cast-target').value!=='custom'}
 $('cast-generate').onclick=()=>{$('casting-dialog').close();$('settings-audio-chapters').click()}
 $('cast-start').onclick=safe(async()=>{
  if(working)return
  const item=items.find(item=>item.id===$('cast-audio').value),blob=file??item?.blob
  if(!blob)throw new Error(t('Elige un audio'))
  if(blob.size>128*1024*1024)throw new Error(t('Máximo de 128 MB por emisión.'))
  const target=$('cast-target').value,appId=target==='custom'?$('cast-app').value.trim():DEFAULT_RECEIVER
  if(target==='custom'&&!/^[a-f\d]{8}$/i.test(appId))throw new Error(t('El identificador Cast debe tener ocho caracteres hexadecimales.'))
  await stop();endpoint=bridgeURL($('cast-bridge').value);abort=new AbortController();working=true;$('cast-start').disabled=true
  try{
   status('Preparando emisión…');const info=await request('/info');if(!info.lan)throw new Error(t('Inicia el servicio local con --red.'))
   const presentation=safePresentation({title:item?.bookTitle??file.name,chapter:item?.label,author:item?.author,language:currentLanguage(),cues:$('cast-text').checked?item?.cues:[],colors:['--paper','--ink','--accent'].map(name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim())})
   session=await request('/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({presentation,minutes:Number($('cast-minutes').value)})})
   const mime=file?({'wav':'audio/wav','mp3':'audio/mpeg','ogg':'audio/ogg','flac':'audio/flac','m4a':'audio/mp4'}[file.name.split('.').at(-1).toLowerCase()]??file.type):blob.type
   await request(`/media/${session.token}`,{method:'POST',headers:{'Content-Type':mime},body:blob})
   writeJSON('lector-casting',{bridge:endpoint,appId:$('cast-app').value.trim()})
   if(target!=='browser'){await sender.connect(appId);await sender.load(session.mediaURL,mime,presentation)}
   session.target=target;$('cast-link').href=session.receiverURL;$('cast-link').hidden=target!=='browser';$('cast-copy').hidden=target!=='browser';$('cast-controls').hidden=false;status(target==='browser'?'Abre el receptor en el otro dispositivo.':'Emisión conectada')
  }catch(error){await stop().catch(()=>{});throw error}finally{working=false;abort=null;$('cast-start').disabled=false}
 })
 const command=action=>safe(async()=>{if(!session)return;const seconds=Number($('cast-seconds').value);if(session.target==='browser')await request(`/control/${session.token}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,seconds})});else if(action==='seek')sender.seek(seconds);else sender[action]()})
 $('cast-pause').onclick=command('pause');$('cast-play').onclick=command('play');$('cast-seek').onclick=command('seek');$('cast-stop').onclick=safe(stop)
 $('cast-copy').onclick=safe(async()=>{if(session)await navigator.clipboard.writeText(session.receiverURL)})
 // Closing settings never stops a running session or clears its temporary link.
 return {stop}
}
