import {VoiceDiagnostics} from './voice-diagnostics.js'
import {icon} from './icons.js'
import {t,currentLanguage} from './i18n.js'

export function createVoiceDiagnostics({speech,closePanels}){
  const $=selector=>document.querySelector(selector),results=new Map(),selected=new Set()
  const button=document.createElement('button');button.id='voice-diagnostics-open';button.className='settings-link';button.textContent='Diagnóstico de voces'
  $('#browser-voice-settings').append(button)
  const dialog=document.createElement('dialog');dialog.id='voice-diagnostics-dialog';dialog.className='small-dialog';dialog.setAttribute('aria-labelledby','voice-diagnostics-title')
  dialog.innerHTML=`<div class="panel-heading"><h2 id="voice-diagnostics-title">Diagnóstico de voces</h2><button class="icon-button" id="voice-diagnostics-close" aria-label="Cerrar">${icon('close')}</button></div>
  <p class="small muted">Prueba las voces de este navegador o dispositivo. No cambia tu voz elegida. Las voces de red pueden enviar la muestra a su proveedor.</p>
  <label class="field">Idioma y región<select id="voice-diagnostics-language"></select></label>
  <label class="field">Texto de prueba<input id="voice-diagnostics-text" maxlength="200" data-user-content></label>
  <div class="editor-actions"><button id="voice-diagnostics-all" class="text-button">Seleccionar visibles</button><button id="voice-diagnostics-none" class="text-button">Quitar selección</button></div>
  <div id="voice-diagnostics-list"></div>
  <div class="editor-actions"><button id="voice-diagnostics-run" class="primary-button">Probar selección</button><button id="voice-diagnostics-cancel" class="text-button" hidden>Cancelar</button></div>
  <p id="voice-diagnostics-progress" class="small muted" role="status" aria-live="polite"></p>
  <p id="voice-diagnostics-error" class="small error" role="alert" hidden></p>
  <p class="small muted">El navegador informa de errores, no de la calidad audible. Los resultados solo corresponden a esta sesión y perfil.</p>`
  $('#app').append(dialog)
  let voices=[],finished=0,total=0,initialized=false
  const key=voice=>JSON.stringify([voice.voiceURI,voice.lang])
  const label=result=>t(({completed:'Sin error comunicado',failed:'Fallo',timeout:'Sin respuesta',cancelled:'Cancelada',unavailable:'Ya no disponible',playing:'Reproduciendo…'})[result?.status]||'Sin probar')+(result?.error?` (${result.error})`:'')
  const visible=()=>voices.filter(voice=>!$('#voice-diagnostics-language').value||voice.lang===$('#voice-diagnostics-language').value)
  function sync(){
    const busy=diagnostics.running
    for(const id of ['language','text','all','none','run'])$(`#voice-diagnostics-${id}`).disabled=busy
    const count=visible().filter(voice=>selected.has(key(voice))).length
    $('#voice-diagnostics-run').disabled=busy||!count
    $('#voice-diagnostics-run').textContent=`${t('Probar selección')} (${count})`
    $('#voice-diagnostics-cancel').hidden=!busy
    for(const input of dialog.querySelectorAll('input[type=checkbox]'))input.disabled=busy
  }
  function render(){
    const list=$('#voice-diagnostics-list');list.replaceChildren()
    for(const voice of visible()){
      const row=document.createElement('label');row.className='voice-diagnostic-row'
      const check=document.createElement('input');check.type='checkbox';check.checked=selected.has(key(voice));check.setAttribute('aria-label',voice.name)
      check.onchange=()=>{check.checked?selected.add(key(voice)):selected.delete(key(voice));sync()}
      const info=document.createElement('span'),name=document.createElement('span'),detail=document.createElement('small'),status=document.createElement('small')
      name.textContent=voice.name;name.dataset.userContent='';detail.className='muted';detail.textContent=`${voice.lang} · ${t(voice.localService===true?'Local':voice.localService===false?'Red':'Origen no indicado')}`;detail.dataset.userContent=''
      status.className='voice-diagnostic-result';status.dataset.userContent='';status.textContent=label(results.get(key(voice)));row.dataset.voiceKey=key(voice)
      info.append(name,detail,status);row.append(check,info);list.append(row)
    }
    if(!voices.length){const empty=document.createElement('p');empty.className='small muted';empty.textContent=t('No hay voces disponibles. Reabre esta ventana cuando el sistema las haya cargado.');list.append(empty)}
    sync()
  }
  const diagnostics=new VoiceDiagnostics({isBusy:()=>speech.state!=='stopped',onLock:()=>sync(),onStart:voice=>{
    results.set(key(voice),{status:'playing'});render()
  },onResult:(voice,result)=>{
    results.set(key(voice),result);finished++;render();$('#voice-diagnostics-progress').textContent=`${finished} / ${total}`
  }})
  function refresh(){
    if(diagnostics.running)return
    const prior=$('#voice-diagnostics-language').value
    voices=(globalThis.speechSynthesis?.getVoices()??[]).filter(voice=>voice.voiceURI).sort((a,b)=>a.lang.localeCompare(b.lang)||a.name.localeCompare(b.name))
    const locales=[...new Set(voices.map(voice=>voice.lang))],select=$('#voice-diagnostics-language');select.replaceChildren(new Option(t('Todos'),''),...locales.map(locale=>new Option(locale,locale)))
    const preferred=navigator.languages?.find(locale=>locales.includes(locale))??locales.find(locale=>locale.toLowerCase().split(/[-_]/)[0]===currentLanguage())
    select.value=initialized&&locales.includes(prior)?prior:initialized&&prior===''?'':preferred??''
    if(!initialized){for(const voice of visible().slice(0,25))selected.add(key(voice));if(!$('#voice-diagnostics-text').value)$('#voice-diagnostics-text').value=t('La tarde caía despacio. Por un momento, todo quedó en silencio.');initialized=voices.length>0}
    render()
  }
  button.onclick=()=>{closePanels();refresh();dialog.showModal()}
  $('#voice-diagnostics-close').onclick=()=>dialog.close()
  dialog.addEventListener('close',()=>diagnostics.cancel())
  dialog.addEventListener('cancel',()=>diagnostics.cancel())
  $('#voice-diagnostics-language').onchange=render
  $('#voice-diagnostics-all').onclick=()=>{for(const voice of visible())selected.add(key(voice));render()}
  $('#voice-diagnostics-none').onclick=()=>{selected.clear();render()}
  $('#voice-diagnostics-cancel').onclick=()=>diagnostics.cancel()
  $('#voice-diagnostics-run').onclick=async()=>{
    const chosen=visible().filter(voice=>selected.has(key(voice)));total=chosen.length;finished=0
    $('#voice-diagnostics-error').hidden=true;$('#voice-diagnostics-progress').textContent=`0 / ${total}`
    for(const voice of chosen)results.delete(key(voice));render()
    try{await diagnostics.start(chosen,$('#voice-diagnostics-text').value)}catch(error){$('#voice-diagnostics-error').textContent=t(error.message);$('#voice-diagnostics-error').hidden=false}finally{render()}
  }
  globalThis.speechSynthesis?.addEventListener('voiceschanged',()=>{if(dialog.open)refresh()})
  window.addEventListener('pagehide',()=>diagnostics.cancel())
  document.addEventListener('visibilitychange',()=>{if(document.hidden)diagnostics.cancel()})
  return diagnostics
}
