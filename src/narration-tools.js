import {icon} from './icons.js'
import {t} from './i18n.js'
import {safeCast,narrationProfiles,dialogueSuggestions,parsedSpeakerSuggestions} from './narration.js'
import {readableParagraphs,requestContext} from './context-core.js'
import {readJSON} from './storage.js'

export function addNarrationMenus(){
 const body=document.querySelector('#voice-panel .shared-settings')
 body.insertAdjacentHTML('beforeend','<button id="settings-narration" class="settings-link">Personajes y narración</button>')
 const dialog=document.createElement('dialog');dialog.id='narration-dialog';dialog.className='narration-dialog';dialog.innerHTML=`<div class="panel-heading"><h2>Personajes y narración</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><label class="check-field"><input type="checkbox" data-setting="narrationEnabled">Activar voces de personajes</label><details class="settings-section" open><summary>Reparto del libro</summary><label class="field">Personaje<select id="narration-character" data-user-content></select></label><div class="editor-actions"><button id="narration-new" class="text-button">Añadir personaje</button><button id="narration-delete" class="text-button">Eliminar personaje</button></div><form id="narration-character-form"><label class="field">Nombre del personaje<input id="character-name" maxlength="60" data-user-content></label><div class="filter-grid"><label class="field">Ritmo del personaje<input id="character-rate" type="number" min=".5" max="2" step=".05" value="1"></label><label class="field">Tono del personaje<input id="character-pitch" type="number" min=".5" max="1.5" step=".05" value="1"></label></div><label class="field">Voz del navegador<select id="character-voice" data-user-content></select></label><details class="settings-section"><summary>Voces de IA del personaje</summary><label class="field">Voz de OpenAI<input id="character-apiVoice" maxlength="100" data-user-content></label><label class="field">Identificador de voz<input id="character-elevenVoice" maxlength="100" data-user-content></label><label class="field">Voz local<input id="character-localVoice" maxlength="160" list="character-local-voices" data-user-content></label><datalist id="character-local-voices"></datalist><label class="field">Interlocutor local<input id="character-localSpeaker" type="number" min="0" max="999" placeholder="Automático"></label><label class="field">Indicaciones del personaje<textarea id="character-instructions" maxlength="1000" rows="2" data-user-content></textarea></label></details><button type="submit" class="text-button">Guardar personaje</button></form></details><details class="settings-section"><summary>Corregir interlocutores</summary><p class="small muted">Selecciona un fragmento del libro para asignarlo. Las correcciones se conservan por libro.</p><p id="narration-selected" data-user-content></p><label class="field">Quién habla<select id="narration-assign-character" data-user-content></select></label><button id="narration-assign" class="text-button">Asignar fragmento seleccionado</button><div id="narration-assignments"></div></details><details class="settings-section"><summary>Propuestas de interlocutores</summary><button id="narration-detect" class="text-button">Buscar diálogos en esta sección</button><p class="small muted">Son propuestas para revisar, no identificaciones seguras. No se deduce el género.</p><div id="narration-proposals"></div><details class="settings-section"><summary>Analizar con IA</summary><p class="small muted">Solo se envía el fragmento mostrado, hasta 3000 caracteres, al motor de Idiomas y contexto. Puede tener coste.</p><textarea id="narration-ai-text" rows="5" maxlength="3000" readonly data-user-content></textarea><p id="narration-ai-destination" class="small muted"></p><div class="editor-actions"><button id="narration-ai-run" class="text-button">Analizar fragmento mostrado</button><button id="narration-ai-cancel" class="text-button" hidden>Cancelar</button></div></details></details><details class="settings-section"><summary>Perfiles de narración</summary><label class="field">Perfil de narración<select data-setting="narrationProfile">${narrationProfiles.map(profile=>`<option value="${profile.id}">${profile.label}</option>`).join('')}</select></label><label class="field">Indicaciones del perfil personal<textarea data-setting="narrationPrompt" rows="3" maxlength="1000" data-user-content></textarea></label><p class="small muted">El tono depende de la voz. Piper no interpreta emociones; el navegador usa ritmo y tono. Las indicaciones se aplican a las APIs que las admiten.</p><p class="small muted">La exportación conserva el audio generado por el motor; el ritmo de reproducción se ajusta al escucharlo.</p></details><p id="narration-message" role="status" class="small muted"></p>`
 document.querySelector('#app').append(dialog)
 document.getElementById('context-dialog').insertAdjacentHTML('beforeend','<button id="context-assign-speaker" class="text-button">Asignar interlocutor</button>')
}
export function createNarrationTools({view,getRecord,getSettings,getSelection,save,closePanels,onError}){
 const $=id=>document.getElementById(id),dialog=$('narration-dialog');let sourceID,selected,proposalDoc,proposalIndex,paragraphs=[],suggestions=[],request,job=0,assignmentLimit=100
 const safe=fn=>async(...args)=>{try{await fn(...args)}catch(error){$('narration-message').textContent=t(error.message);onError(error)}}
 const cast=()=>{const record=getRecord();if(!record||record.id!==sourceID)throw new Error('Abre primero un libro.');return record.narration=safeCast(record.narration)}
 const label=character=>character.id==='narrator'?t('Narrador'):character.name
 const store=async()=>{await save();$('narration-message').textContent=t(getSettings().narrationEnabled?'Reparto guardado. Se aplica a los siguientes fragmentos sin detener la voz.':'Reparto guardado. Activa las voces de personajes para utilizarlo.')}
 function character(){return cast().characters.find(item=>item.id===$('narration-character').value)??cast().characters[0]}
 function fill(){
  const item=character();$('character-name').value=item.id==='narrator'?t('Narrador'):item.name;$('character-name').disabled=item.id==='narrator';$('narration-delete').disabled=item.id==='narrator'
  for(const key of ['rate','pitch','apiVoice','elevenVoice','localVoice','localSpeaker','instructions'])$('character-'+key).value=item[key]??(key==='rate'||key==='pitch'?1:'')
  const voices=globalThis.speechSynthesis?.getVoices()??[];$('character-voice').replaceChildren(new Option(t('Usar la voz general'),''),...voices.map(voice=>new Option(`${voice.name} · ${voice.lang}`,voice.voiceURI)))
  if(item.voice&&!voices.some(voice=>voice.voiceURI===item.voice))$('character-voice').add(new Option(item.voice,item.voice));$('character-voice').value=item.voice??''
  $('character-local-voices').replaceChildren(...Array.from($('local-voices').options).map(option=>new Option(option.text,option.value)))
 }
 function render(){
  const data=cast(),current=$('narration-character').value,assigned=$('narration-assign-character').value
  for(const id of ['narration-character','narration-assign-character'])$(id).replaceChildren(...data.characters.map(item=>new Option(label(item),item.id)))
  if(data.characters.some(item=>item.id===current))$('narration-character').value=current
  if(data.characters.some(item=>item.id===assigned))$('narration-assign-character').value=assigned
  fill();$('narration-selected').textContent=selected?.quote??'';$('narration-assign').disabled=!selected
  $('narration-assignments').replaceChildren()
  for(const item of data.assignments.slice(-assignmentLimit).reverse()){
   const row=document.createElement('div');row.className='narration-assignment';const text=document.createElement('span');text.dataset.userContent='';text.textContent=`${label(data.characters.find(character=>character.id===item.characterId))}: ${item.quote}`
   const remove=document.createElement('button');remove.className='icon-button';remove.setAttribute('aria-label',t('Eliminar'));remove.innerHTML=icon('trash');remove.onclick=safe(async()=>{getRecord().narration.assignments=data.assignments.filter(entry=>entry.id!==item.id);await store();render()});row.append(text,remove);$('narration-assignments').append(row)
  }
  if(data.assignments.length>assignmentLimit){const more=document.createElement('button');more.className='text-button';more.textContent=t('Mostrar más');more.onclick=safe(()=>{assignmentLimit+=100;render()});$('narration-assignments').append(more)}
 }
 const open=safe(async()=>{
  await view.renderer?.whenNavigationIdle?.()
  if(!getRecord())throw new Error('Abre primero un libro.')
  sourceID=getRecord().id;const selection=getSelection();selected=selection?.bookId===sourceID?{cfi:selection.cfi,quote:selection.quote}:null
  closePanels();if($('context-dialog').open)$('context-dialog').close();job++;request?.abort();request=null;assignmentLimit=100;suggestions=[];$('narration-proposals').replaceChildren();$('narration-message').textContent='';render()
  const current=view.renderer.getContents()[0];proposalDoc=current.doc.cloneNode(true);proposalIndex=current.index;paragraphs=readableParagraphs(proposalDoc)
  $('narration-ai-text').value=paragraphs.map(part=>part.text).join('\n\n').slice(0,3000)
  const config=readJSON('lector-language-tools',{});$('narration-ai-run').disabled=!['ollama','chat'].includes(config.provider)||!config.model
  $('narration-ai-destination').textContent=config.provider==='none'||!config.model?t('Configura un motor en Idiomas y contexto.'):`${config.provider}: ${config.endpoint}`
  dialog.showModal()
 })
 $('settings-narration').onclick=open;$('context-assign-speaker').onclick=open
 $('narration-character').onchange=safe(fill)
 $('narration-new').onclick=safe(async()=>{const data=cast();if(data.characters.length>=100)throw new Error('Máximo de 100 personajes.');const id=`actor-${crypto.randomUUID()}`;data.characters.push({id,name:t('Nuevo personaje'),rate:1,pitch:1});await store();render();$('narration-character').value=id;fill();$('character-name').focus();$('character-name').select()})
 $('narration-delete').onclick=safe(async()=>{const item=character();if(item.id==='narrator')return;const data=cast();data.characters=data.characters.filter(entry=>entry.id!==item.id);data.assignments=data.assignments.filter(entry=>entry.characterId!==item.id);getRecord().narration=data;await store();render()})
 $('narration-character-form').onsubmit=safe(async event=>{
  event.preventDefault();const item=character(),data=cast(),draft={...item,name:item.id==='narrator'?'':$('character-name').value.trim()};if(item.id!=='narrator'&&!draft.name)throw new Error('Escribe un nombre para el personaje.')
  for(const key of ['voice','rate','pitch','apiVoice','elevenVoice','localVoice','localSpeaker','instructions'])draft[key]=$('character-'+key).value
  getRecord().narration=safeCast({...data,characters:data.characters.map(entry=>entry.id===item.id?draft:entry)});await store();render()
 })
 async function assign(cfi,quote,characterId){const data=cast();if(data.assignments.length>=2000)throw new Error('Máximo de 2000 correcciones por libro.');data.assignments=data.assignments.filter(item=>item.cfi!==cfi);data.assignments.push({id:crypto.randomUUID(),cfi,quote,characterId});getRecord().narration=data;await store();render()}
 $('narration-assign').onclick=safe(async()=>{if(selected)await assign(selected.cfi,selected.quote,$('narration-assign-character').value)})
 function renderProposals(){
  $('narration-proposals').replaceChildren()
  for(const suggestion of suggestions){const row=document.createElement('div');row.className='narration-proposal';const quote=document.createElement('p');quote.dataset.userContent='';quote.textContent=suggestion.quote;const name=document.createElement('input');name.dataset.userContent='';name.value=suggestion.name;name.maxLength=60;name.setAttribute('aria-label',t('Nombre del personaje'));name.placeholder=t('Quién habla');const accept=document.createElement('button');accept.className='text-button';accept.textContent=t('Aplicar interlocutor');accept.onclick=safe(async()=>{const value=name.value.trim();if(!value)throw new Error('Escribe un nombre para el personaje.');let data=cast(),item=data.characters.find(item=>item.name.toLocaleLowerCase()===value.toLocaleLowerCase());if(!item){if(data.characters.length>=100)throw new Error('Máximo de 100 personajes.');item={id:`actor-${crypto.randomUUID()}`,name:value,rate:1,pitch:1};data.characters.push(item);getRecord().narration=data}await assign(suggestion.cfi,suggestion.quote,item.id);suggestions=suggestions.filter(item=>item!==suggestion);renderProposals()});row.append(quote,name,accept);$('narration-proposals').append(row)}
  if(!suggestions.length){const empty=document.createElement('p');empty.className='small muted';empty.textContent=t('No hay propuestas pendientes.');$('narration-proposals').append(empty)}
 }
 $('narration-detect').onclick=safe(()=>{suggestions=dialogueSuggestions(paragraphs,view,proposalIndex);renderProposals()})
 $('narration-ai-cancel').onclick=()=>request?.abort()
 $('narration-ai-run').onclick=safe(async()=>{
  if(request)return;const config=readJSON('lector-language-tools',{}),controller=request=new AbortController(),sequence=++job,preview=$('narration-ai-text').value
  $('narration-ai-run').disabled=true;$('narration-ai-cancel').hidden=false;$('narration-message').textContent=t('Analizando interlocutores…')
  try{
   const output=await requestContext({...config,key:$('context-key').value.trim(),task:'characters',word:'',text:preview,sourceLanguage:getSettings().language,language:getSettings().language,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(120000)])})
   if(controller.signal.aborted||sequence!==job||getRecord()?.id!==sourceID||!dialog.open)return
   suggestions=parsedSpeakerSuggestions(output,paragraphs,view,proposalIndex,preview);renderProposals();$('narration-message').textContent=t('Revisa las propuestas antes de aplicarlas.')
  }catch(error){if(!controller.signal.aborted)throw error;else if(dialog.open)$('narration-message').textContent=t('Generación cancelada')}
  finally{if(request===controller)request=null;if(sequence===job){$('narration-ai-cancel').hidden=true;$('narration-ai-run').disabled=false}}
 })
 dialog.addEventListener('close',()=>{job++;request?.abort()})
 return {close:()=>{if(dialog.open)dialog.close()}}
}
