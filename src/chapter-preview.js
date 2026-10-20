import {icon} from './icons.js'
import {t} from './i18n.js'
import './chapter-preview.css'

const ignored='script,style,head,template,noscript,[hidden],[aria-hidden="true"]'
const blockTags='h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,figcaption,td,dd,dt'
// Read an inert document, never the live paginator. Only plain text is copied
// into the preview, so book markup cannot run scripts or request remote media.
export function chapterExcerpt(doc,anchor=0,limit=5000){
  if(!doc?.body)throw Error('No hay texto disponible para esta vista previa.')
  const original=typeof anchor==='function'?anchor(doc):anchor
  let start,offset=0
  if(typeof original==='number'){
    const walker=doc.createTreeWalker(doc.body,4,{acceptNode:node=>node.parentElement.closest(ignored)?2:1}),nodes=[]
    for(let node=walker.nextNode();node;node=walker.nextNode())if(node.textContent.trim())nodes.push(node)
    const total=nodes.reduce((sum,node)=>sum+node.length,0);let left=Math.min(Math.max(0,total-1),Math.floor(total*Math.max(0,Math.min(1,original))))
    for(const node of nodes){if(left<node.length){start=node;offset=left;break}left-=node.length}
    if(original>=1&&nodes.length){start=nodes.at(-1).parentElement.closest(blockTags)??nodes.at(-1);offset=0}
  }else if(original?.startContainer){start=original.startContainer;offset=original.startOffset}
  else if(original?.nodeType)start=original
  else if(typeof anchor==='function')throw Error('No se encontró esta ubicación en el capítulo.')
  const range=doc.createRange();range.selectNodeContents(doc.body)
  if(start&&doc.body.contains(start)){
    if(start.nodeType===3)range.setStart(start,offset)
    else if(start!==doc.body)range.setStartBefore(start)
  }
  const fragment=range.cloneContents()
  for(const element of fragment.querySelectorAll(ignored))element.remove()
  const walker=doc.createTreeWalker(fragment,4),parts=[]
  for(let node=walker.nextNode();node;node=walker.nextNode()){
    const parent=node.parentElement,element=parent?.closest(blockTags)??parent??fragment,last=parts.at(-1)
    if(last?.element===element)last.text+=node.textContent
    else parts.push({element,text:node.textContent})
  }
  const blocks=[];let remaining=limit,truncated=false
  for(const {element,text:raw} of parts){
    const text=raw.replace(/\s+/gu,' ').trim();if(!text)continue
    if(!remaining){truncated=true;break}
    const value=text.slice(0,remaining).replace(/[\uD800-\uDBFF]$/u,'');blocks.push({heading:/^h[1-6]$/i.test(element.localName??''),text:value});remaining-=value.length
    if(text.length>value.length){truncated=true;break}
  }
  return {blocks,truncated}
}

export function createChapterPreview({view,getBook,getRecord,navigate,onError}){
  const dialog=document.createElement('dialog');dialog.id='chapter-preview-dialog';dialog.className='chapter-preview-dialog';dialog.setAttribute('aria-labelledby','chapter-preview-title')
  dialog.innerHTML=`<div class="panel-heading"><h2 id="chapter-preview-title">Vista previa</h2><button class="icon-button dialog-close" aria-label="Cerrar">${icon('close')}</button></div><h3 id="chapter-preview-label" data-user-content></h3><p id="chapter-preview-hint" class="small muted"></p><div id="chapter-preview-status" class="small muted" role="status"></div><div id="chapter-preview-content" data-user-content></div><button id="chapter-preview-go" class="primary-button">Ir a esta ubicación</button>`
  document.querySelector('#app').append(dialog)
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape')event.stopPropagation()})
  const $=selector=>dialog.querySelector(selector)
  let sequence=0,selected,opener
  function close(){sequence++;selected=undefined;if(dialog.open)dialog.close()}
  dialog.addEventListener('close',()=>{if(dialog.open)return;sequence++;selected=undefined;$('#chapter-preview-content').replaceChildren();opener?.isConnected&&opener.focus({preventScroll:true})})
  async function open({target,fraction=false,label='',trigger=document.activeElement}){
    const book=getBook(),record=getRecord();if(!book||!record)return
    const job=++sequence;selected=undefined;opener=trigger
    $('#chapter-preview-label').textContent=label;$('#chapter-preview-content').replaceChildren();$('#chapter-preview-go').disabled=true
    $('#chapter-preview-hint').textContent=t(fraction?'Vista aproximada de la posición. La página actual y el audio no cambian.':'La página actual y el audio no cambian hasta que decidas ir.')
    $('#chapter-preview-status').textContent=t('Preparando vista previa…');if(!dialog.open)dialog.showModal()
    try{
      const resolved=view.resolveNavigation(fraction?{fraction:target}:target),section=book.sections[resolved?.index]
      if(!section?.createDocument)throw Error('No hay texto disponible para esta vista previa.')
      const doc=await section.createDocument()
      if(job!==sequence||!dialog.open||getBook()!==book||getRecord()?.id!==record.id)return
      const {blocks}=chapterExcerpt(doc,resolved.anchor??0)
      if(!blocks.length)throw Error('No hay texto disponible para esta vista previa.')
      for(const block of blocks){const element=document.createElement(block.heading?'h4':'p');element.textContent=block.text;$('#chapter-preview-content').append(element)}
      selected={target,fraction};$('#chapter-preview-status').textContent='';$('#chapter-preview-go').disabled=false
    }catch(error){if(job===sequence&&dialog.open)$('#chapter-preview-status').textContent=t(['No se encontró esta ubicación en el capítulo.','No hay texto disponible para esta vista previa.'].includes(error.message)?error.message:'No se pudo preparar esta vista previa.')}
  }
  $('#chapter-preview-go').onclick=async()=>{const destination=selected;if(!destination)return;close();try{await navigate(destination.target,destination.fraction)}catch(error){onError(error)}}
  const positionButton=document.createElement('button');positionButton.id='position-preview';positionButton.type='button';positionButton.className='text-button';positionButton.textContent='Previsualizar ubicación';document.querySelector('#go-position').after(positionButton)
  positionButton.onclick=()=>{const value=Number(document.querySelector('#position-input').value);if(Number.isFinite(value)&&value>=0&&value<=100)open({target:value/100,fraction:true,label:t('Posición del libro')+` · ${value} %`,trigger:positionButton})}
  function button(item){
    const label=item.label||t('Sin título'),preview=document.createElement('button');preview.type='button';preview.className='icon-button toc-preview';preview.innerHTML=icon('zen');preview.dataset.previewLabel=label;preview.setAttribute('aria-label',t('Previsualizar capítulo')+': '+label);preview.title=t('Previsualizar capítulo');preview.onclick=()=>open({target:item.href,label,trigger:preview});return preview
  }
  function refresh(){for(const preview of document.querySelectorAll('.toc-preview')){preview.setAttribute('aria-label',t('Previsualizar capítulo')+': '+preview.dataset.previewLabel);preview.title=t('Previsualizar capítulo')}}
  return {button,open,close,refresh}
}
