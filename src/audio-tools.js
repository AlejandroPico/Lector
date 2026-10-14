import {icon} from './icons.js'
import {t} from './i18n.js'
import {pronunciationRules,pronounce,audioEstimate,waveHeader,pcmMono} from './audio-policy.js'
import {readableParagraphs} from './context-core.js'
import {sanitizeBookHTML} from './books.js'
import {allAudioChapters,saveAudioChapter,removeAudioChapter} from './storage.js'
import {splitSentences} from './speech.js'
export function addAudioMenus(settings){
 const body=document.querySelector('#voice-panel .shared-settings')
 const check=(key,label)=>`<label class="check-field"><input type="checkbox" data-setting="${key}" ${settings[key]?'checked':''}>${label}</label>`
 const number=(key,label,min,max,step=1)=>`<label class="field">${label}<input type="number" data-setting="${key}" value="${settings[key]}" min="${min}" max="${max}" step="${step}"></label>`
 const section=document.createElement('details');section.className='settings-section';section.innerHTML=`<summary>Temporizador y retroceso</summary>${check('sleepEnabled','Activar temporizador')}${number('sleepMinutes','Minutos hasta detener',1,240)}<p id="sleep-status" class="small muted" hidden></p><label class="field">Retroceder<select data-setting="rewindMode"><option value="sentence">Una frase</option><option value="seconds">Unos segundos</option></select></label>${number('rewindSeconds','Segundos de retroceso',3,120)}<p class="small muted">En voces del navegador, retroceder segundos vuelve a una frase aproximada.</p>`
 body.append(section)
 const pronunciation=document.createElement('details');pronunciation.className='settings-section';pronunciation.innerHTML=`<summary>Pronunciaciones personales</summary>${check('pronunciationsEnabled','Aplicar pronunciaciones')}<div id="pronunciation-list"></div><div class="pronunciation-form"><label class="field">Texto escrito<input id="pronunciation-from" maxlength="100"></label><label class="field">Cómo se pronuncia<input id="pronunciation-to" maxlength="200"></label></div><label class="check-field"><input id="pronunciation-whole" type="checkbox" checked>Solo palabras completas</label><button id="pronunciation-add" class="text-button">Añadir pronunciación</button><p class="small muted">Sustituciones literales, sensibles a mayúsculas. Solo cambia la voz, no el libro.</p>`;body.append(pronunciation)
 const costs=document.createElement('details');costs.className='settings-section';costs.innerHTML=`<summary>Coste y límites de audio</summary><div class="filter-grid">${number('voicePrice','Tarifa configurada',0,1000,.0001)}<label class="field">Tarifa por<select data-setting="voicePriceUnit"><option value="characters">1000 caracteres</option><option value="minutes">Minuto de audio estimado</option></select></label><label class="field">Moneda<select data-setting="voiceCurrency"><option>EUR</option><option>USD</option><option>GBP</option></select></label>${number('costMargin','Factor de reserva',1,3,.05)}</div>${check('costLimitEnabled','Limitar gasto estimado')}${number('costLimit','Límite de gasto estimado',.01,10000,.01)}${check('characterLimitEnabled','Limitar caracteres enviados')}${number('characterLimit','Máximo de caracteres',1,100000000)}${number('audioResponseLimitMB','Máximo por respuesta (MB)',1,64)}${number('audioExportLimitMB','Máximo por capítulo (MB)',8,512)}<p id="audio-usage" class="small muted"></p><button id="audio-reset-usage" class="text-button">Reiniciar contador</button><p class="small muted">Estimación según tu tarifa; no es la factura. Incluye intentos cancelados. Configura también los límites de tu proveedor.</p>`;body.append(costs)
 body.insertAdjacentHTML('beforeend','<button id="settings-audio-chapters" class="settings-link">Audio por capítulos</button>')
 document.querySelector('.voice-actions').insertAdjacentHTML('afterbegin',`<button id="audio-rewind" class="icon-button" disabled aria-label="Retroceder audio" title="Retroceder audio">${icon('undo')}</button>`)
 const dialog=document.createElement('dialog');dialog.id='audio-export-dialog';dialog.className='audio-export-dialog';dialog.innerHTML=`<div class="panel-heading"><h2>Audio por capítulos</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><label class="field">Capítulo<select id="audio-chapter" data-user-content></select></label><details class="settings-section"><summary>Texto que se enviará</summary><p id="audio-text-preview" data-user-content></p></details><p id="audio-chapter-estimate" class="small muted"></p><p class="small muted">Generar procesa el capítulo con el motor elegido. Las voces del navegador no producen archivos exportables.</p><label class="check-field"><input id="audio-remember" type="checkbox" checked>Guardar audio en este navegador</label><div class="editor-actions"><button id="audio-generate" class="primary-button" disabled>Generar capítulo</button><button id="audio-export-cancel" class="text-button" hidden>Cancelar</button></div><p id="audio-export-progress" role="status" hidden></p><p id="audio-export-error" role="status"></p><div id="audio-saved-list"></div>`;document.querySelector('#app').append(dialog)
}
export function createAudioTools({speech,view,getBook,getRecord,getSettings,saveSettings,closePanels,onError}){
 const $=id=>document.getElementById(id),dialog=$('audio-export-dialog');let controller,source,recordID,chapters=[],text='',parts=[],sequence=0,urls=[],transient=[],working=false,audioLimit=30
 const safe=fn=>async(...args)=>{try{await fn(...args)}catch(error){onError(error)}}
 const money=cost=>`${cost.toFixed(4)} ${getSettings().voiceCurrency}`
 function refresh(){
   $('audio-rewind').disabled=speech.historyBook!==getBook()||!speech.history.length
   $('sleep-status').hidden=!speech.timer.deadline;$('sleep-status').textContent=`${t('Tiempo restante')}: ${Math.ceil(speech.timer.remaining()/60000)} ${t('min')}`
   const usage=speech.budget.usage();$('audio-usage').textContent=`${t('Consumo estimado')}: ${getSettings().voicePrice>0?money(usage.cost):t('Tarifa sin configurar')} · ${usage.characters} ${t('caracteres')} · ${usage.requests} ${t('solicitudes')}${usage.unpriced?` · ${usage.unpriced} ${t('solicitudes sin tarifa')}`:''}`
 }
 function renderPronunciations(){
   $('pronunciation-list').replaceChildren()
   for(const [index,rule]of getSettings().pronunciations.entries()){
     const row=document.createElement('div');row.className='pronunciation-row';const span=document.createElement('span');span.dataset.userContent='';span.textContent=`${rule.from} → ${rule.to}`;const remove=document.createElement('button');remove.className='icon-button';remove.setAttribute('aria-label','Eliminar');remove.innerHTML=icon('trash');remove.onclick=()=>{getSettings().pronunciations.splice(index,1);saveSettings();renderPronunciations()};row.append(span,remove);$('pronunciation-list').append(row)
   }
 }
 $('pronunciation-add').onclick=safe(()=>{const settings=getSettings();if(settings.pronunciations.length>=100)throw new Error(t('Máximo de 100 pronunciaciones.'));const rules=pronunciationRules([{from:$('pronunciation-from').value,to:$('pronunciation-to').value,whole:$('pronunciation-whole').checked}]);if(!rules.length)return;settings.pronunciations.push(rules[0]);saveSettings();$('pronunciation-from').value=$('pronunciation-to').value='';renderPronunciations()})
 $('audio-rewind').onclick=safe(()=>speech.rewind())
 $('audio-reset-usage').onclick=safe(()=>{speech.budget.reset();refresh()})
 const cancel=()=>controller?.abort()
 $('audio-export-cancel').onclick=cancel
 dialog.addEventListener('close',()=>{sequence++;cancel();source=null;text='';parts=[];for(const url of urls)URL.revokeObjectURL(url);urls=[];$('audio-saved-list').replaceChildren()})
 async function loadChapter(){
   const job=++sequence,snapshot=source,chapter=chapters[Number($('audio-chapter').value)];text='';parts=[];$('audio-generate').disabled=true;$('audio-text-preview').textContent='';if(!chapter)return
   const sections=[]
   for(let index=chapter.start;index<chapter.end;index++){
     if(snapshot.sections[index].linear==='no')continue
     const section=snapshot.sections[index],doc=section.createDocument?await section.createDocument():new DOMParser().parseFromString(sanitizeBookHTML(await(await fetch(await section.load())).text()),'text/html')
     sections.push(readableParagraphs(doc).map(part=>part.text).join('\n\n'))
     if(job!==sequence||source!==snapshot)return
   }
   text=sections.join('\n\n').trim();parts=splitSentences(text,1600,getSettings().language,getSettings().pronunciationsEnabled?getSettings().pronunciations.map(rule=>rule.from).filter(term=>term.includes('.')):[]).map(segment=>pronounce(segment.text,getSettings().pronunciations,getSettings().pronunciationsEnabled).text)
   const actual=parts.join(' '),estimate=audioEstimate(actual,getSettings());$('audio-text-preview').textContent=actual.slice(0,3000)+(actual.length>3000?'…':'');$('audio-chapter-estimate').textContent=`${estimate.characters} ${t('caracteres')} · ${Math.ceil(estimate.minutes)} ${t('min')} · ${getSettings().provider==='piper'?t('Sin coste de API'):getSettings().voicePrice>0?money(estimate.cost):t('Tarifa sin configurar')}`
   $('audio-generate').disabled=!text||getSettings().provider==='browser';$('audio-export-error').textContent=''
 }
 async function renderSaved(){
   for(const url of urls)URL.revokeObjectURL(url);urls=[];$('audio-saved-list').replaceChildren()
   const records=[...(await allAudioChapters()).filter(item=>item.bookId===recordID),...transient.filter(item=>item.bookId===recordID)].sort((a,b)=>b.createdAt-a.createdAt)
   for(const item of records.slice(0,audioLimit)){
     const row=document.createElement('details');row.className='settings-section';const summary=document.createElement('summary');summary.dataset.userContent='';summary.textContent=`${item.label} · ${(item.blob.size/1024/1024).toFixed(1)} MB`;const audio=document.createElement('audio'),url=URL.createObjectURL(item.blob);urls.push(url);audio.controls=true;audio.preload='none';audio.src=url
     const save=document.createElement('button');save.className='text-button';save.textContent='Guardar archivo de audio';save.onclick=safe(async()=>{
       const name=`${item.bookTitle} - ${item.label}`.replace(/[<>:"/\\|?*\u0000-\u001f]/g,' ').slice(0,120)+'.wav'
       if(window.showSaveFilePicker){let writable;try{const handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'WAV',accept:{'audio/wav':['.wav']}}]});writable=await handle.createWritable();await writable.write(item.blob);await writable.close()}catch(error){await writable?.abort().catch(()=>{});if(error.name!=='AbortError')throw error}}
       else {const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click()}
     })
     const remove=document.createElement('button');remove.className='text-button';remove.textContent='Eliminar';remove.onclick=safe(async()=>{audio.pause();await removeAudioChapter(item.id);transient=transient.filter(value=>value.id!==item.id);await renderSaved()});row.append(summary,audio,save,remove);$('audio-saved-list').append(row)
   }
   if(records.length>audioLimit){const more=document.createElement('button');more.className='text-button';more.textContent='Mostrar más';more.onclick=safe(async()=>{audioLimit+=30;await renderSaved()});$('audio-saved-list').append(more)}
 }
 $('settings-audio-chapters').onclick=safe(async()=>{
   if(!getBook())throw new Error(t('Abre primero un libro.'));closePanels();source=getBook();recordID=getRecord().id;audioLimit=30
   const starts=new Map();for(const item of source.toc??[]){const index=view.resolveNavigation(item.href)?.index;if(Number.isInteger(index)&&!starts.has(index))starts.set(index,item.label)}
   if(!starts.size)for(let index=0;index<source.sections.length;index++)if(source.sections[index].linear!=='no')starts.set(index,`${t('Sección')} ${index+1}`)
   if(!starts.has(0))starts.set(0,`${t('Sección')} 1`)
   const indices=[...starts.keys()].sort((a,b)=>a-b);chapters=indices.map((start,index)=>({start,end:indices[index+1]??source.sections.length,label:String(starts.get(start))}));$('audio-chapter').replaceChildren(...chapters.map((chapter,index)=>new Option(chapter.label,String(index))))
   const current=view.renderer.getContents()[0]?.index??0;$('audio-chapter').value=String(Math.max(0,chapters.findLastIndex(chapter=>chapter.start<=current)));dialog.showModal();await loadChapter();await renderSaved()
 })
 $('audio-chapter').onchange=safe(loadChapter)
 $('audio-generate').onclick=async()=>{
   if(working||!parts.length)return
   const snapshot=source,id=recordID,chapter=chapters[Number($('audio-chapter').value)],settings={...getSettings()},segments=[...parts],bookTitle=getRecord().title,remember=$('audio-remember').checked
   if(settings.provider==='browser')return
   working=true;const abort=controller=new AbortController();$('audio-export-error').textContent='';$('audio-export-progress').hidden=false;$('audio-export-cancel').hidden=false;$('audio-generate').disabled=true;$('audio-chapter').disabled=true
   let decoder
   try{
     decoder=new OfflineAudioContext(1,1,24000);const chunks=[];let samples=0
     for(const [index,segment]of segments.entries()){
       abort.signal.throwIfAborted();if(getBook()!==snapshot)throw new DOMException('Canceled','AbortError')
       $('audio-export-progress').textContent=`${t('Generando audio…')} ${index+1} / ${segments.length}`
       const blob=await speech.generateAudio(segment,{signal:abort.signal,settings});const decoded=await decoder.decodeAudioData(await blob.arrayBuffer());abort.signal.throwIfAborted()
       const pcm=pcmMono(decoded);samples+=pcm.byteLength/2;if(44+samples*2>settings.audioExportLimitMB*1024*1024)throw new Error(t('El capítulo supera el límite de tamaño configurado.'));chunks.push(pcm)
     }
     abort.signal.throwIfAborted();const blob=new Blob([waveHeader(samples),...chunks],{type:'audio/wav'}),item={id:crypto.randomUUID(),bookId:id,bookTitle,label:chapter.label,blob,createdAt:Date.now(),voice:settings.apiVoice,model:settings.model}
     if(remember){try{await saveAudioChapter(item)}catch{transient.push(item);$('audio-export-error').textContent=t('No se pudo guardar el audio. Está disponible durante esta sesión.')}}else transient.push(item)
     if(!abort.signal.aborted&&dialog.open){await renderSaved();$('audio-export-progress').textContent=t('Audio listo. Se conserva sin descargar archivos.')}
   }catch(error){if(dialog.open)$('audio-export-error').textContent=abort.signal.aborted?t('Generación cancelada'):t(error.message)}finally{working=false;if(controller===abort)controller=null;$('audio-export-cancel').hidden=true;$('audio-chapter').disabled=false;$('audio-generate').disabled=!text||getSettings().provider==='browser';refresh()}
 }
 renderPronunciations();refresh()
 return {refresh,cancel}
}
