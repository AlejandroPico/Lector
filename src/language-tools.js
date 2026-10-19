import {browserContextAvailability,requestBrowserContext} from './browser-context.js'
import {importBook,metadataText,sanitizeBookHTML} from './books.js'
import {readJSON,writeJSON,getTranslation,saveTranslation,removeTranslation} from './storage.js'
import {lookupOffline} from './offline-dictionaries.js'
import {currentLanguage,languages,t} from './i18n.js'
import {icon} from './icons.js'
import {fonts} from './presentation.js'
import {selectedContext,readableParagraphs,alignedParagraphs,requestContext,contextEndpoint} from './context-core.js'

export function createLanguageTools({getBook,getRecord,getSelection,view,prepareReading,navigateTo,toggleAudio,showSettings,closePanels,getSettings,onError}) {
  const $=selector=>document.querySelector(selector)
  const stored=readJSON('lector-language-tools',{})
  const config={provider:['none','ollama','chat','browser'].includes(stored.provider)?stored.provider:'none',endpoint:typeof stored.endpoint==='string'?stored.endpoint:'http://127.0.0.1:11434/api/chat',model:typeof stored.model==='string'?stored.model.slice(0,160):'',follow:stored.follow!==false}
  let browserState='unchecked',availabilitySequence=0
  let request,querySequence=0,contextLanguage,translationBook,translation,sourceBook,sourceID,original=[],translated=[],rows=[],sourceIndex=0,targetIndex=0,limit=160,renderSequence=0,importSequence=0,saveQueue=Promise.resolve(),remember=true
  const handle=fn=>async(...args)=>{try{await fn(...args)}catch(error){
    if($('#bilingual-dialog').open){$('#bilingual-error').textContent=t(error.message);$('#bilingual-error').hidden=false}
    else if($('#context-dialog').open){$('#context-error').textContent=t(error.message);$('#context-error').hidden=false}
    else onError(error)
  }}
  const saveConfig=()=>writeJSON('lector-language-tools',config)
  const paragraphCache=new WeakMap()
  const transientTranslations=new Map()
  function paragraphsOf(doc){let paragraphs=paragraphCache.get(doc);if(!paragraphs){paragraphs=readableParagraphs(doc);paragraphCache.set(doc,paragraphs)}return paragraphs}
  function syncConnection() {
    $('#context-connection').hidden=!['ollama','chat'].includes(config.provider)
    $('#context-browser').hidden=config.provider!=='browser'
    $('#context-key-field').hidden=config.provider!=='chat'
    $('#context-cloud-notice').hidden=config.provider!=='chat'
    $('#context-local-notice').hidden=config.provider!=='ollama'
    for(const key of ['provider','endpoint','model'])$(`#context-${key}`).value=config[key]
    const ready=config.provider==='browser'?['available','downloadable','downloading'].includes(browserState):['chat','ollama'].includes(config.provider)&&Boolean(config.model.trim())
    $('#context-run').disabled=!ready||Boolean(request)
    $('#context-run').textContent=t(config.provider==='browser'&&browserState!=='available'?'Descargar modelo y consultar':config.provider==='browser'?'Consultar en este equipo':'Enviar fragmento')
    $('#context-selection').classList.toggle('context-unconfigured',!ready)
    $('#context-selection').title=ready?'':t('Configura un motor en Idiomas y contexto.')
    $('#context-destination').textContent=config.provider==='browser'?t(browserState==='unavailable'?'La IA del navegador no está disponible para este equipo o idioma.':'IA del navegador · local'):config.provider==='none'?t('Configura un motor en Idiomas y contexto.'):`${config.provider==='ollama'?t('Ollama · servicio local'):t('API compatible con Chat Completions')}: ${config.endpoint}`
  }
  for(const key of ['provider','endpoint','model'])$(`#context-${key}`).addEventListener('change',()=>{
    request?.abort();config[key]=$(`#context-${key}`).value.trim()
    if(key==='provider') {
      config.endpoint=config.provider==='ollama'?'http://127.0.0.1:11434/api/chat':config.provider==='chat'?'https://api.openai.com/v1/chat/completions':config.endpoint
      $('#context-key').value=''
    }
    if(key==='endpoint')$('#context-key').value=''
    saveConfig();syncConnection();if(config.provider==='browser')void checkBrowser()
  })
  async function checkBrowser() {
    const sequence=++availabilitySequence
    browserState='unchecked';syncConnection()
    const state=await browserContextAvailability(contextLanguage||currentLanguage(),$('#context-output-language').value||currentLanguage())
    if(sequence!==availabilitySequence)return
    browserState=state
    $('#context-browser-status').textContent=t(state==='available'?'Modelo listo':state==='downloadable'||state==='downloading'?'Modelo pendiente de descarga':'La IA del navegador no está disponible para este equipo o idioma.')
    syncConnection()
  }
  $('#context-check').onclick=()=>void checkBrowser()
  function clearContextRequest(){request?.abort();request=undefined;$('#context-cancel').hidden=true;syncConnection()}
  async function openContext() {
    const selection=getSelection(),snapshot=selectedContext(selection,(metadataText(getBook()?.metadata?.language)||currentLanguage()).split(/[-_]/)[0])
    closePanels();$('#selection-menu').hidden=true;clearContextRequest();contextLanguage=snapshot.language
    const sequence=++querySequence
    $('#context-word').value=snapshot.word;$('#context-fragment').value=snapshot.text;$('#context-output-language').value=currentLanguage()
    $('#context-answer').hidden=true;$('#context-error').hidden=true;$('#context-dictionary').hidden=true
    $('#context-dialog').showModal();syncConnection();if(config.provider==='browser')void checkBrowser()
    const definition=await lookupOffline(snapshot.word,contextLanguage,{project:true}).catch(()=>null)
    if(sequence!==querySequence||!$('#context-dialog').open)return
    if(definition){
      $('#context-definition').textContent=definition.definition
      $('#context-definition-source').textContent=definition.basic?t('Glosario básico'):`${definition.pack.name} · ${t('Definiciones')}: ${languages[definition.pack.definitionLanguage]??definition.pack.definitionLanguage}`
      for(const [id,url,label] of [['context-definition-link',definition.sourceURL,t('Consultar en Wikcionario ↗')],['context-definition-license',definition.pack?.licenseURL,definition.pack?.license]]) {
        const anchor=$(`#${id}`);anchor.hidden=!url||!/^https:\/\//.test(url);if(!anchor.hidden){anchor.href=url;anchor.textContent=label}
      }
      $('#context-dictionary').hidden=false
    }
  }
  $('#context-selection').onclick=handle(openContext)
  $('#dictionary-context').onclick=handle(openContext)
  $('#context-configure').onclick=()=>{$('#context-dialog').close();showSettings();$('#language-settings').open=true;$('#language-settings > details').open=true;$('#language-settings').scrollIntoView({block:'start'})}
  $('#context-dialog').addEventListener('close',()=>{querySequence++;clearContextRequest()})
  $('#context-cancel').onclick=()=>request?.abort()
  $('#context-run').onclick=async()=>{
    if(request)return
    const controller=request=new AbortController(),task=$('#context-task').value
    $('#context-error').hidden=true;$('#context-answer').hidden=true;$('#context-cancel').hidden=false;syncConnection()
    // Snapshot the preview and provider. Editing controls cannot change a running request.
    const input={...config,key:$('#context-key').value.trim(),task,word:$('#context-word').value.trim(),text:$('#context-fragment').value.trim(),language:$('#context-output-language').value,sourceLanguage:contextLanguage,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(120000)])}
    try {
      if(input.provider!=='browser')contextEndpoint(input.endpoint,input.provider==='ollama')
      const output=await (input.provider==='browser'?requestBrowserContext(input,{onProgress:percent=>{if(request===controller)$('#context-destination').textContent=`${t('Descargando modelo')}: ${percent}%`}}):requestContext(input))
      if(controller.signal.aborted||request!==controller||!$('#context-dialog').open)return
      $('#context-answer-title').textContent=t(task==='translate'?'Traducción generada':'Explicación generada');$('#context-result').textContent=output;$('#context-answer').hidden=false
    } catch(error) {
      if(!$('#context-dialog').open||request!==controller)return
      $('#context-error').textContent=t(controller.signal.aborted?'Consulta cancelada':error.name==='TimeoutError'?'Tiempo de espera agotado.':error instanceof TypeError?'No se pudo conectar. Revisa el servicio y sus permisos de conexión.':error.message)
      $('#context-error').hidden=false
    } finally {if(request===controller){request=undefined;$('#context-cancel').hidden=true;syncConnection();if(config.provider==='browser')void checkBrowser()}}
  }
  for(const id of ['context-word','context-fragment','context-task','context-output-language'])$(`#${id}`).addEventListener('input',()=>{
    clearContextRequest();$('#context-answer').hidden=true;$('#context-dictionary').hidden=true;if(config.provider==='browser')void checkBrowser()
  })

  const sectionLabel=(book,index)=>{
    const find=items=>{for(const item of items??[]){try{if(book.resolveHref(item.href)?.index===index)return metadataText(item.label)}catch{}const nested=find(item.subitems);if(nested)return nested}}
    return find(book.toc)||`${t('Sección')} ${index+1}`
  }
  function sectionOptions(select,book,current) {
    select.replaceChildren()
    for(let index=0;index<book.sections.length;index++)if(book.sections[index].linear!=='no') {
      const option=new Option(sectionLabel(book,index),index);option.dataset.userContent='';select.append(option)
    }
    select.value=String(current);if(select.selectedIndex<0)select.selectedIndex=0
    return Number(select.value)
  }
  const pairConfig=()=>translation?.mapping?.[sourceIndex]??{section:targetIndex,offset:0,pairs:{}}
  function persist() {
    if(!translation||!sourceID)return Promise.resolve()
    if(!remember&&translation.file)transientTranslations.set(sourceID,structuredClone(translation))
    else transientTranslations.delete(sourceID)
    const snapshot=structuredClone({...translation,id:sourceID,file:remember?translation.file:undefined,updatedAt:Date.now()})
    saveQueue=saveQueue.catch(()=>{}).then(()=>saveTranslation(snapshot))
    return saveQueue
  }
  async function sectionParagraphs(book,index,live=false) {
    let doc=live?view.renderer?.getContents().find(content=>content.index===index)?.doc:null
    if(!doc){const url=await book.sections[index].load(),response=await fetch(url);if(!response.ok)throw new Error('No se pudo cargar este capítulo.');doc=new DOMParser().parseFromString(sanitizeBookHTML(await response.text()),'text/html')}
    return paragraphsOf(doc).map(paragraph=>({...paragraph,...(live?{cfi:view.getCFI(index,paragraph.range)}:{})}))
  }
  function renderRows() {
    rows=alignedParagraphs(original,translated,pairConfig());const container=$('#bilingual-text');container.replaceChildren()
    const settings=getSettings();container.style.fontFamily=fonts.find(([id])=>id===settings.font)?.[1]??'Georgia,serif';container.style.fontSize=`${settings.fontSize}px`;container.style.lineHeight=settings.lineHeight
    for(const row of rows.slice(0,limit)) {
      const element=document.createElement('article');element.className='bilingual-row'
      if(row.originalIndex!==null)element.dataset.originalParagraph=row.originalIndex
      for(const [kind,paragraph] of [['original',row.source],['translation',row.target]]){
        const text=document.createElement('p');text.className=`bilingual-${kind}`;text.dataset.userContent='';text.textContent=paragraph?.text??'—';text.lang=kind==='original'?metadataText(sourceBook.metadata?.language)||currentLanguage():translation?.language||currentLanguage();text.dir='auto';element.append(text)
      }
      if(row.source) {
        const jump=document.createElement('button');jump.className='icon-button bilingual-jump';jump.innerHTML=icon('right');jump.title=t('Continuar aquí');jump.setAttribute('aria-label',`${jump.title}: ${row.originalIndex+1}`)
        jump.onclick=handle(async()=>{await navigateTo(row.source.cfi);$('#bilingual-dialog').close()})
        element.append(jump)
      }
      container.append(element)
    }
    $('#bilingual-more').hidden=rows.length<=limit
    $('#bilingual-empty').hidden=Boolean(translationBook)
    $('#bilingual-audio').disabled=!getRecord()
  }
  async function renderChapter() {
    const sequence=++renderSequence;$('#bilingual-progress').hidden=false;$('#bilingual-progress').textContent=t('Cargando capítulos…');$('#bilingual-error').hidden=true
    try {
      const [left,right]=await Promise.all([sectionParagraphs(sourceBook,sourceIndex,true),translationBook?sectionParagraphs(translationBook,targetIndex):Promise.resolve([])])
      if(sequence!==renderSequence||!$('#bilingual-dialog').open)return
      original=left;translated=right
      const alignment=pairConfig();$('#bilingual-offset').value=alignment.offset??0
      const selector=$('#bilingual-source-paragraph');selector.replaceChildren(...original.map(({text},index)=>{const option=new Option(`${index+1}. ${text.slice(0,60)}`,index);option.dataset.userContent='';return option}))
      $('#bilingual-target-paragraph').max=translated.length
      $('#bilingual-target-paragraph').value=translated.length?1:0
      renderRows();$('#bilingual-text').scrollTop=0
    } finally {if(sequence===renderSequence)$('#bilingual-progress').hidden=true}
  }
  async function openBilingual() {
    if(!getRecord())throw new Error('Abre un libro antes de iniciar la lectura.')
    await prepareReading();closePanels();sourceBook=getBook()
    const transient=transientTranslations.get(getRecord().id)
    sourceID=getRecord().id
    translationBook?.destroy?.();translationBook=undefined
    translation=transient??await getTranslation(sourceID)??{id:sourceID,mapping:{},language:currentLanguage()}
    translation.mapping??={}
    sourceIndex=view.renderer?.getContents()[0]?.index??0
    sourceIndex=sectionOptions($('#bilingual-original-section'),sourceBook,sourceIndex)
    remember=transient?false:Boolean(translation.file)||!translation.filename;$('#bilingual-remember').checked=remember;$('#bilingual-follow').checked=config.follow
    $('#bilingual-dialog').showModal();$('#bilingual-text').replaceChildren();$('#bilingual-empty').hidden=false
    if(translation.file)translationBook=await importBook(new File([translation.file],translation.filename,{type:translation.file.type}))
    targetIndex=pairConfig().section??sourceIndex
    if(translationBook)targetIndex=sectionOptions($('#bilingual-translation-section'),translationBook,targetIndex)
    else $('#bilingual-translation-section').replaceChildren()
    $('#bilingual-language').value=Object.hasOwn(languages,translation.language)?translation.language:currentLanguage()
    limit=160;await renderChapter()
  }
  $('#settings-bilingual').onclick=handle(openBilingual)
  $('#bilingual-import').onclick=()=>$('#bilingual-file').click()
  $('#bilingual-choose-file').onclick=()=>$('#bilingual-file').click()
  $('#bilingual-file').onchange=handle(async()=>{
    const file=$('#bilingual-file').files[0];$('#bilingual-file').value='';if(!file)return
    if(file.size>100*1024*1024)throw new Error('El límite de esta versión es de 100 MB por archivo.')
    const sequence=++importSequence,id=sourceID;$('#bilingual-progress').hidden=false;$('#bilingual-progress').textContent=t('Abriendo traducción…')
    let imported
    try {
      imported=await importBook(file)
      if(sequence!==importSequence||id!==sourceID||!$('#bilingual-dialog').open){imported.destroy?.();return}
      translationBook?.destroy?.();translationBook=imported
      const language=metadataText(imported.metadata?.language).split('-')[0]
      translation={id,file,filename:file.name,language:Object.hasOwn(languages,language)?language:currentLanguage(),mapping:{}}
      remember=$('#bilingual-remember').checked;$('#bilingual-language').value=translation.language
      targetIndex=sectionOptions($('#bilingual-translation-section'),translationBook,sourceIndex)
      translation.mapping[sourceIndex]={section:targetIndex,offset:0,pairs:{}}
      await persist();limit=160;await renderChapter()
    } catch(error){if(imported!==translationBook)imported?.destroy?.();throw error}
    finally{$('#bilingual-progress').hidden=true}
  })
  $('#bilingual-original-section').onchange=handle(async()=>{
    sourceIndex=Number($('#bilingual-original-section').value);targetIndex=pairConfig().section??sourceIndex
    if(translationBook)targetIndex=sectionOptions($('#bilingual-translation-section'),translationBook,targetIndex)
    limit=160;await renderChapter()
    if(original[0])await navigateTo(original[0].cfi)
  })
  $('#bilingual-translation-section').onchange=handle(async()=>{
    if(!translationBook)return
    targetIndex=Number($('#bilingual-translation-section').value);translation.mapping[sourceIndex]={section:targetIndex,offset:0,pairs:{}}
    await persist();limit=160;await renderChapter()
  })
  $('#bilingual-adjust').onclick=()=>{const area=$('#bilingual-alignment');area.hidden=!area.hidden;$('#bilingual-adjust').setAttribute('aria-expanded',!area.hidden)}
  async function updatePair(change) {
    if(!translationBook)return
    translation.mapping[sourceIndex]={...pairConfig(),...change,section:targetIndex};await persist();renderRows()
  }
  $('#bilingual-offset').onchange=handle(()=>{const value=Number($('#bilingual-offset').value);return updatePair({offset:Number.isFinite(value)?Math.max(-10000,Math.min(10000,Math.trunc(value))):0,pairs:{}})})
  $('#bilingual-pair').onclick=handle(()=>{
    if(!translationBook)return
    const source=Number($('#bilingual-source-paragraph').value),target=Number($('#bilingual-target-paragraph').value)
    if(!Number.isInteger(source)||source<0||source>=original.length||!Number.isInteger(target)||target<0||target>translated.length)throw new Error('Elige un párrafo válido en ambos textos.')
    return updatePair({pairs:{...pairConfig().pairs,[source]:target===0?null:target-1}})
  })
  $('#bilingual-reset').onclick=handle(()=>updatePair({offset:0,pairs:{}}))
  $('#bilingual-language').onchange=handle(async()=>{translation.language=$('#bilingual-language').value;await persist();renderRows()})
  $('#bilingual-remember').onchange=handle(async()=>{remember=$('#bilingual-remember').checked;await persist()})
  $('#bilingual-follow').onchange=()=>{config.follow=$('#bilingual-follow').checked;saveConfig()}
  $('#bilingual-remove').onclick=handle(async()=>{
    await saveQueue.catch(()=>{});await removeTranslation(sourceID);transientTranslations.delete(sourceID);translationBook?.destroy?.();translationBook=undefined
    translation={id:sourceID,mapping:{},language:currentLanguage()};translated=[];$('#bilingual-translation-section').replaceChildren();renderRows()
  })
  $('#bilingual-more').onclick=()=>{const top=$('#bilingual-text').scrollTop;limit+=160;renderRows();$('#bilingual-text').scrollTop=top}
  $('#bilingual-audio').onclick=handle(toggleAudio)
  $('#bilingual-dialog').addEventListener('close',()=>{renderSequence++;importSequence++;document.defaultView.CSS?.highlights?.delete('parallel-spoken');$('#bilingual-progress').hidden=true;original=[];translated=[];rows=[];sourceBook=undefined;$('#bilingual-text').replaceChildren();translationBook?.destroy?.();translationBook=undefined})

  function follow(range) {
    if(!$('#bilingual-dialog').open)return
    if(!range){document.defaultView.CSS?.highlights?.delete('parallel-spoken');$('#bilingual-text .current')?.classList.remove('current');return}
    const current=view.renderer?.getContents().find(content=>content.doc===range.startContainer.ownerDocument)
    if(!current)return
    if(current.index!==sourceIndex){
      if(!config.follow||!getSettings().followSpeech)return
      sourceIndex=current.index;$('#bilingual-original-section').value=sourceIndex
      targetIndex=pairConfig().section??sourceIndex
      if(translationBook)targetIndex=sectionOptions($('#bilingual-translation-section'),translationBook,targetIndex)
      limit=160;handle(async()=>{await renderChapter();follow(range)})();return
    }
    const blocks=paragraphsOf(current.doc),index=blocks.findIndex(({offsets})=>offsets.has(range.startContainer))
    if(index<0)return
    if(index>=limit){const top=$('#bilingual-text').scrollTop;limit=index+160;renderRows();$('#bilingual-text').scrollTop=top}
    const row=$(`[data-original-paragraph="${index}"]`);if(!row)return
    $('#bilingual-text .current')?.classList.remove('current')
    document.defaultView.CSS?.highlights?.delete('parallel-spoken')
    if(getSettings().highlight) {
      row.classList.add('current')
      const node=row.querySelector('.bilingual-original').firstChild
      const start=Math.max(0,Math.min(node.length,blocks[index].offsets.get(range.startContainer)+range.startOffset)),end=Math.min(node.length,start+range.toString().length),highlight=document.createRange()
      highlight.setStart(node,start);highlight.setEnd(node,end)
      if(globalThis.Highlight&&CSS.highlights)CSS.highlights.set('parallel-spoken',new Highlight(highlight))
    }
    const bounds=row.getBoundingClientRect(),stage=$('#bilingual-text').getBoundingClientRect()
    if(config.follow&&getSettings().followSpeech&&(bounds.bottom>stage.bottom||bounds.top<stage.top))row.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})
  }
  function audioState(state) {$('#bilingual-audio').innerHTML=icon(state==='playing'?'pause':'play');$('#bilingual-audio').setAttribute('aria-label',t(state==='playing'?'Pausar lectura':'Leer en voz alta'))}
  syncConnection()
  async function forget(id){await saveQueue.catch(()=>{});transientTranslations.delete(id);if(sourceID===id){translationBook?.destroy?.();translationBook=undefined;translation=undefined;sourceBook=undefined;sourceID=undefined}}
  return {follow,audioState,refresh:syncConnection,forget}
}
