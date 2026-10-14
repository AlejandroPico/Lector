import {icon} from './icons.js'
import {languages,t,currentLanguage} from './i18n.js'
import {orderedPDFLines} from './pdf-layout.js'
export const ocrLanguages={es:'spa',ca:'cat',en:'eng',fr:'fra',de:'deu',pt:'por',it:'ita',zh:'chi_sim',ja:'jpn',hi:'hin'}
export function addPDFMenus(){
  const host=document.createElement('details');host.id='pdf-settings';host.className='settings-section';host.innerHTML='<summary>PDF y reconocimiento de texto</summary><button id="settings-pdf" class="settings-link" disabled>Revisar PDF y reconocer texto</button>';document.querySelector('#preferences-panel').append(host)
  const dialog=document.createElement('dialog');dialog.id='pdf-dialog';dialog.className='pdf-dialog';dialog.innerHTML=`<div class="panel-heading"><h2>PDF y reconocimiento de texto</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><div class="pdf-toolbar"><label class="field">Página<select id="pdf-page"></select></label><button id="pdf-original-preview" class="icon-button" aria-label="Ver página original" title="Ver página original">${icon('image')}</button><span id="pdf-source" class="small muted"></span></div><details class="settings-section"><summary>Orden de lectura</summary><label class="field">Orden de lectura<select id="pdf-order"><option value="auto">Detectar columnas</option><option value="original">Orden del archivo</option><option value="1">Una</option><option value="2">Dos</option><option value="3">Tres</option></select></label><label class="check-field"><input id="pdf-hide-margins" type="checkbox">Omitir encabezados y pies repetidos</label><p class="small muted">Revisa el orden: tablas y diseños complejos pueden necesitar corrección manual.</p></details><details class="settings-section"><summary>Reconocer páginas escaneadas</summary><div class="filter-grid"><label class="field">Idioma<select id="pdf-ocr-language">${Object.entries(languages).map(([code,label])=>`<option value="${code}">${label}</option>`).join('')}</select></label><label class="field">Desde la página<input id="pdf-ocr-start" type="number" min="1" value="1"></label><label class="field">Hasta la página<input id="pdf-ocr-end" type="number" min="1" value="1"></label></div><p class="small muted">OCR local. Al iniciar se descarga el modelo del idioma, si falta; las páginas no se envían. Hasta 50 páginas por tanda.</p><button id="pdf-ocr-run" class="text-button">Reconocer texto</button><button id="pdf-ocr-cancel" class="text-button" hidden>Cancelar</button><div id="pdf-ocr-progress" role="status" hidden></div></details><label class="field pdf-review">Texto revisable<textarea id="pdf-text" data-user-content rows="12" maxlength="500000"></textarea></label><p class="small muted">Los cambios se guardan en este navegador. El PDF original permanece intacto; las anotaciones de texto modificado pueden necesitar reubicación.</p><div class="editor-actions"><button id="pdf-apply" class="primary-button">Aplicar a la lectura</button><button id="pdf-reset" class="text-button">Restaurar texto original</button></div><p id="pdf-error" role="status"></p>`
  document.querySelector('#app').append(dialog)
}
export function createPDFTools({getBook,getRecord,getIndex,apply,showOriginal,closePanels}){
  const $=id=>document.getElementById(id),dialog=$('pdf-dialog');let snapshot,staged={},worker,renderTask,canceled=false,active=false,selected=0,dirty=false
  const options=()=>({order:$('pdf-order').value,hideMargins:$('pdf-hide-margins').checked})
  const base=index=>orderedPDFLines(snapshot.pdfPages[index],options(),snapshot.pdfRepeated).map(line=>line.text).join('\n')
  const store=()=>{if(dirty){staged[selected]={text:$('pdf-text').value,source:staged[selected]?.source??'revised'};dirty=false}}
  const show=()=>{
    const item=staged[selected];$('pdf-text').value=item?.text??base(selected);dirty=false
    $('pdf-source').textContent=t(item?.source==='ocr'?'Texto reconocido · revisa los errores':item?'Texto revisado':'Texto original del PDF')
  }
  const cancel=()=>{canceled=true;renderTask?.cancel();if(worker){worker.postMessage({cancel:true});const owned=worker;setTimeout(()=>owned.terminate(),100);worker=null} }
  dialog.addEventListener('close',()=>{cancel();snapshot=null;staged={}})
  $('settings-pdf').onclick=()=>{
    snapshot=getBook();if(!snapshot?.pdf)return
    staged=structuredClone(getRecord()?.pdfText??{});const configured=getRecord()?.pdfOptions??{order:'auto',hideMargins:false};$('pdf-order').value=configured.order;$('pdf-hide-margins').checked=configured.hideMargins
    selected=Math.min(snapshot.pdfPages.length-1,getIndex()??0);$('pdf-page').replaceChildren(...snapshot.pdfPages.map((_,i)=>new Option(`${t('Página')} ${i+1}`,String(i))));$('pdf-page').value=String(selected)
    for(const id of ['pdf-ocr-start','pdf-ocr-end']){$(id).value=String(selected+1);$(id).max=snapshot.pdfPages.length}
    $('pdf-ocr-language').value=currentLanguage();$('pdf-error').textContent='';closePanels();show();dialog.showModal()
  }
  $('pdf-page').onchange=()=>{store();selected=Number($('pdf-page').value);show()}
  $('pdf-text').oninput=()=>dirty=true
  for(const id of ['pdf-order','pdf-hide-margins'])$(id).onchange=()=>{store();show()}
  $('pdf-reset').onclick=()=>{delete staged[selected];show()}
  $('pdf-original-preview').onclick=async()=>{try{await showOriginal(selected+1)}catch(error){$('pdf-error').textContent=error.message}}
  $('pdf-apply').onclick=async()=>{if(active)return;store();const changes=staged,configuration=options(),index=selected;$('pdf-apply').disabled=true;try{await apply(changes,configuration,index);dialog.close()}catch(error){$('pdf-error').textContent=error.message}finally{$('pdf-apply').disabled=false}}
  $('pdf-ocr-cancel').onclick=cancel
  $('pdf-ocr-run').onclick=async()=>{
    if(active||!snapshot)return
    const start=Number($('pdf-ocr-start').value),end=Number($('pdf-ocr-end').value),pdf=snapshot.pdf
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<start||end>pdf.numPages||end-start>=50){$('pdf-error').textContent=t('Elige un intervalo válido de hasta 50 páginas.');return}
    store();active=true;canceled=false;$('pdf-error').textContent='';$('pdf-ocr-run').disabled=true;$('pdf-apply').disabled=true;$('pdf-text').disabled=true;$('pdf-ocr-cancel').hidden=false;$('pdf-ocr-progress').hidden=false
    let pendingReject
    const owned=worker=new Worker(new URL('./ocr-worker.js',import.meta.url),{type:'module'}),language=ocrLanguages[$('pdf-ocr-language').value]
    const originalCancel=cancel
    $('pdf-ocr-cancel').onclick=()=>{originalCancel();pendingReject?.(new DOMException('Canceled','AbortError'))}
    const onClose=()=>pendingReject?.(new DOMException('Canceled','AbortError'));dialog.addEventListener('close',onClose)
    try{
      for(let number=start;number<=end;number++){
        if(canceled)throw new DOMException('Canceled','AbortError')
        const page=await pdf.getPage(number),baseViewport=page.getViewport({scale:1}),scale=Math.min(2.5,Math.sqrt(4000000/(baseViewport.width*baseViewport.height))),viewport=page.getViewport({scale})
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height)
        try{
          renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport});await renderTask.promise;renderTask=null
          if(canceled)throw new DOMException('Canceled','AbortError')
          const image=canvas.toDataURL('image/png')
          const result=await new Promise((resolve,reject)=>{
            pendingReject=reject;const timeout=setTimeout(()=>reject(new Error(t('El reconocimiento ha tardado demasiado.'))),180000)
            owned.onmessage=({data})=>{if(data.error){clearTimeout(timeout);reject(new Error(data.error))}else if('text'in data){clearTimeout(timeout);resolve(data)}else $('pdf-ocr-progress').textContent=`${t('Reconociendo texto')} · ${number} / ${end} · ${Math.round((data.progress??0)*100)} %`}
            owned.onerror=()=>{clearTimeout(timeout);reject(new Error(t('No se pudo iniciar el motor OCR.')))}
            pendingReject=error=>{clearTimeout(timeout);reject(error)}
            owned.postMessage({language,image,workerPath:new URL(`${import.meta.env.BASE_URL}ocr/worker.min.js`,location.href).href,corePath:new URL(`${import.meta.env.BASE_URL}ocr/`,location.href).href})
          });pendingReject=null
          if(canceled||snapshot?.pdf!==pdf)throw new DOMException('Canceled','AbortError')
          staged[number-1]={text:result.text,source:'ocr',language,confidence:result.confidence};if(selected===number-1)show()
        }finally{canvas.width=canvas.height=0;page.cleanup()}
      }
      $('pdf-ocr-progress').textContent=t('Texto reconocido listo para revisar')
    }catch(error){$('pdf-error').textContent=t(canceled?'Reconocimiento cancelado':error.message)}finally{
      owned.postMessage({cancel:true});setTimeout(()=>owned.terminate(),100);if(worker===owned)worker=null;renderTask=null;active=false;dialog.removeEventListener('close',onClose);$('pdf-ocr-run').disabled=false;$('pdf-apply').disabled=false;$('pdf-text').disabled=false;$('pdf-ocr-cancel').hidden=true
    }
  }
  return {refresh(){ $('settings-pdf').disabled=!getBook()?.pdf },cancel}
}
