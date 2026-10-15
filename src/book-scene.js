import {effectiveScene} from './scene-palettes.js'
export {effectiveScene,sceneTheme,scenePaperColors} from './scene-palettes.js'
import {t} from './i18n.js'
import {focusedBookPage} from './scene-picker.js'
import './book-scene.css'
// The live reader remains the only navigable book. Temporary sandboxed DOM
// copies preserve its real text and images on both faces of the turning leaf.
export function createBookScene({view,area,settings,getRecord}){
  const background=document.createElement('div');background.id='book-environment';background.setAttribute('aria-hidden','true');document.querySelector('#app').prepend(background)
  const folio=document.createElement('div');folio.className='book-folio';folio.setAttribute('aria-hidden','true');folio.innerHTML='<i class="book-stack book-stack-left"></i><i class="book-stack book-stack-right"></i><i class="book-binding"></i>';area.prepend(folio)
  area.insertAdjacentHTML('beforeend','<button id="book-edge-left" class="book-edge" hidden></button><button id="book-edge-right" class="book-edge" hidden></button><div id="book-page-focus" class="book-page-focus" role="group" hidden><button data-book-side="left">‹</button><button data-book-side="right">›</button></div>')
  const closing=document.createElement('section');closing.id='closing-cover';closing.className='closing-cover';closing.hidden=true;const reopen=document.createElement('button');reopen.className='book-back-cover';reopen.setAttribute('aria-label',t('Volver a las últimas páginas'));closing.append(reopen);area.append(closing)
  let turning=false,activeLayer,boundRenderer,focusSide='left'
  const enabled=()=>settings.appearance==='book'
  const motion=()=>enabled()&&settings.animated&&!matchMedia('(prefers-reduced-motion: reduce)').matches
  function progress(fraction=0){
    const value=Math.max(0,Math.min(1,Number(fraction)||0));area.style.setProperty('--read-stack',`${2+value*12}px`);area.style.setProperty('--unread-stack',`${2+(1-value)*12}px`)
    area.classList.toggle('book-end',value>=.999)
    const focused=focusedBookPage(settings),side=focusSide
    area.dataset.bookSide=side
    area.classList.toggle('book-focused',focused)
    const controls=area.querySelector('#book-page-focus');controls.hidden=!focused||!getRecord();controls.setAttribute('aria-label',t('Página visible'))
    for(const button of controls.querySelectorAll('button')){button.setAttribute('aria-pressed',String(button.dataset.bookSide===side));button.setAttribute('aria-label',t(button.dataset.bookSide==='left'?'Página izquierda':'Página derecha'))}
  }
  function snapshot(){
    const bounds=view.getBoundingClientRect(),frames=[]
    for(const {doc} of view.renderer?.getContents()??[]){
      const frame=doc?.defaultView?.frameElement;if(!frame||!doc.body)continue
      const rect=frame.getBoundingClientRect(),html=doc.documentElement.cloneNode(true)
      for(const node of html.querySelectorAll('script,iframe,object,embed'))node.remove()
      const base=document.createElement('base');base.href=doc.baseURI;html.querySelector('head')?.prepend(base)
      frames.push({html:'<!doctype html>'+html.outerHTML,x:rect.left-bounds.left,y:rect.top-bounds.top,width:frame.clientWidth,height:frame.clientHeight})
    }
    const cover=area.querySelector('#opening-cover:not([hidden]) img')
    return {bounds,frames,cover:cover?.src,back:closing.hidden?null:reopen.outerHTML}
  }
  function paint(face,shot,side){
    const content=document.createElement('div');content.className='book-page-copy';content.style.width=shot.bounds.width+'px';content.style.height=shot.bounds.height+'px';content.style.left=side==='right'?'-100%':'0';face.append(content)
    const loads=[]
    if(shot.back){const back=document.createElement('div');back.className='book-copy-back';back.innerHTML=shot.back;content.append(back)}
    else if(shot.cover){const image=document.createElement('img');image.src=shot.cover;image.className='book-copy-cover';content.append(image)}
    else for(const data of shot.frames){
      const frame=document.createElement('iframe');frame.setAttribute('sandbox','allow-same-origin');frame.tabIndex=-1;frame.title='';frame.setAttribute('aria-hidden','true');frame.style.cssText=`position:absolute;left:${data.x}px;top:${data.y}px;width:${data.width}px;height:${data.height}px;border:0;pointer-events:none;`
      loads.push(new Promise(resolve=>{frame.onload=resolve;setTimeout(resolve,900)}));frame.srcdoc=data.html;content.append(frame)
    }
    return Promise.all(loads)
  }
  async function turn(direction,navigate,force=false){
    const navigatePage=async()=>{
      const before=view.lastLocation?.cfi,result=await navigate()
      if(!force&&focusedBookPage(settings)&&before&&before!==view.lastLocation?.cfi){focusSide=focusSide==='left'?'right':'left';progress(getRecord()?.fraction)}
      return result
    }
    if(!motion()||turning||!getRecord())return navigatePage()
    turning=true;const before=snapshot(),layer=activeLayer=document.createElement('div');layer.className=`book-turn ${direction<0?'book-turn-back':''}`;layer.setAttribute('aria-hidden','true');layer.inert=true
    const areaRect=area.getBoundingClientRect();layer.style.cssText=`left:${before.bounds.left-areaRect.left}px;top:${before.bounds.top-areaRect.top}px;width:${before.bounds.width}px;height:${before.bounds.height}px`
    const still=document.createElement('div');still.className='book-turn-still'
    const leaf=document.createElement('div');leaf.className='book-turn-leaf';const front=document.createElement('div'),back=document.createElement('div');front.className='book-leaf-front';back.className='book-leaf-back';leaf.append(front,back);layer.append(still,leaf);area.append(layer)
    try{
      await Promise.all([paint(front,before,direction>0?'right':'left'),paint(still,before,direction>0?'left':'right')])
      const oldCFI=view.lastLocation?.cfi,result=await navigatePage()
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))
      if(!enabled()||!force&&oldCFI===view.lastLocation?.cfi)return result
      await paint(back,snapshot(),direction>0?'left':'right')
      const animation=leaf.animate([{transform:'rotateY(0deg)'},{transform:`rotateY(${direction>0?-180:180}deg)`}],{duration:720,easing:'cubic-bezier(.32,.03,.24,1)',fill:'forwards'})
      await animation.finished.catch(()=>{})
      return result
    }finally{layer.remove();if(activeLayer===layer)activeLayer=undefined;turning=false}
  }
  function update(){
    reopen.setAttribute('aria-label',t('Volver a las últimas páginas'))
    document.body.classList.toggle('physical-book',enabled());document.body.dataset.bookScene=effectiveScene(settings.bookScene);background.hidden=!enabled();folio.hidden=!enabled()
    for(const [id,label] of [['book-edge-left','Página anterior'],['book-edge-right','Página siguiente']]){const button=area.querySelector('#'+id);button.hidden=!enabled()||!getRecord();button.setAttribute('aria-label',t(label));button.title=t(label)}
    if(!enabled()){activeLayer?.remove();closing.hidden=true;area.classList.remove('back-closed');if(area.querySelector('#opening-cover').hidden)view.inert=false}
    progress(getRecord()?.fraction)
    const renderer=view.renderer
    if(renderer&&renderer!==boundRenderer){boundRenderer=renderer;for(const [method,direction] of [['next',1],['prev',-1]]){const original=renderer[method].bind(renderer);renderer[method]=(...args)=>turn(direction,()=>original(...args))}}
  }
  function hideBack(){closing.hidden=true;area.classList.remove('back-closed');view.inert=false}
  async function openBack(){await turn(-1,hideBack,true)}
  async function closeBack(){
    reopen.replaceChildren();const current=view.renderer?.getContents().at(-1),image=current?.doc.body.classList.contains('reader-cover')?current.doc.querySelector('img'):null
    if(image){const copy=document.createElement('img');copy.src=image.src;copy.alt=t('Contracubierta');reopen.append(copy)}else{const title=document.createElement('span');title.dataset.userContent='';title.textContent=getRecord()?.title??'';reopen.append(title)}
    await turn(1,()=>{closing.hidden=false;area.classList.add('back-closed');view.inert=true},true)
  }
  reopen.onclick=openBack
  return {update,progress,turn,closeBack,openBack,reset:hideBack,get side(){return area.dataset.bookSide},get closed(){return !closing.hidden}}
}
