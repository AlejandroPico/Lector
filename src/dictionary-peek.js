import {icon} from './icons.js'
export function createDictionaryPeek({t,onExpand,onDismiss}){
 const element=document.createElement('section');element.id='dictionary-peek';element.className='dictionary-peek';element.hidden=true;element.setAttribute('role','dialog');element.setAttribute('aria-labelledby','peek-word')
 element.innerHTML=`<div class="peek-heading"><strong id="peek-word" data-user-content></strong><button id="peek-expand" class="icon-button" aria-label="Ampliar definición" title="Ampliar definición">${icon('expand')}</button><button id="peek-close" class="icon-button" aria-label="Cerrar" title="Cerrar">${icon('close')}</button></div><p id="peek-grammar" class="small muted"></p><p id="peek-definition" data-user-content aria-live="polite"></p><p id="peek-source" class="small muted" data-user-content></p>`
 document.querySelector('#app').append(element)
 let anchor,origin,word='',sequence=0
 const $=selector=>element.querySelector(selector)
 function close({restore=true,dismiss=true}={}){
  if(element.hidden)return
  element.hidden=true;sequence++;anchor?.startContainer.ownerDocument.removeEventListener('scroll',onScroll,true)
  if(restore&&element.contains(document.activeElement))origin?.focus?.({preventScroll:true})
  if(dismiss)onDismiss?.()
 }
 function position(){
  if(!anchor?.startContainer.isConnected){close();return}
  const doc=anchor.startContainer.ownerDocument,frame=doc.defaultView?.frameElement,rect=anchor.getBoundingClientRect(),outer=frame?.getBoundingClientRect()
  if(!outer||!rect.width&&!rect.height){close();return}
  const sx=outer.width/frame.clientWidth||1,sy=outer.height/frame.clientHeight||1,point={left:outer.left+rect.left*sx,right:outer.left+rect.right*sx,top:outer.top+rect.top*sy,bottom:outer.top+rect.bottom*sy}
  const viewport=globalThis.visualViewport,left=viewport?.offsetLeft??0,top=viewport?.offsetTop??0,width=viewport?.width??innerWidth,height=viewport?.height??innerHeight
  if(point.bottom<top||point.top>top+height){close();return}
  const box=element.getBoundingClientRect(),x=Math.max(left+10,Math.min(left+width-box.width-10,(point.left+point.right-box.width)/2)),below=point.top-box.height-14<top+10
  const y=Math.max(top+10,Math.min(top+height-box.height-10,below?point.bottom+14:point.top-box.height-14))
  element.style.left=`${x}px`;element.style.top=`${y}px`;element.style.setProperty('--peek-tail',`${Math.max(18,Math.min(box.width-18,(point.left+point.right)/2-x))}px`);element.dataset.side=below?'below':'above'
 }
 function onScroll(){close({restore:false})}
 async function open(selection,lookup){
  close({restore:false,dismiss:false});anchor=selection.range.cloneRange();word=selection.quote;origin=anchor.startContainer.ownerDocument.defaultView.frameElement
  $('#peek-word').textContent=word;$('#peek-grammar').textContent='';$('#peek-definition').textContent=t('Buscando…');$('#peek-source').textContent='';element.hidden=false
  const request=++sequence;position();if(element.hidden)return;$('#peek-close').focus({preventScroll:true});anchor.startContainer.ownerDocument.addEventListener('scroll',onScroll,true)
  const result=await lookup(word)
  if(request!==sequence||element.hidden)return
  $('#peek-grammar').textContent=result.grammar;$('#peek-definition').textContent=result.definition.split('\n').slice(0,2).join('\n').slice(0,650)+(result.definition.split('\n').length>2||result.definition.length>650?'…':'');$('#peek-source').textContent=result.source;position()
 }
 $('#peek-close').onclick=()=>close()
 $('#peek-expand').onclick=()=>{close({restore:false,dismiss:false});onExpand(word)}
 element.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}})
 globalThis.addEventListener('resize',()=>close({restore:false}));globalThis.visualViewport?.addEventListener('resize',()=>close({restore:false}))
 return {open,close,position,get visible(){return !element.hidden},element}
}
