import {t} from './i18n.js'
import './book-page-drag.css'

export function dragProgress(start,x,direction,width){
  return Math.max(0,Math.min(1,(start-x)*direction/Math.max(1,width)))
}
export const completesDrag=progress=>progress>=.35

export function addPageDragControls(){
  document.querySelector('#paper-light-settings').insertAdjacentHTML('beforebegin','<label id="book-drag-field" class="check-field" hidden><input type="checkbox" data-setting="bookCornerDrag">Pasar página arrastrando una esquina</label>')
}

// Only these small margin targets capture pointers. Text, pictures, scrolling
// and the optional camera editor keep their own gestures.
export function createPageDrag({area,view,settings,canStart,prepare,navigate,onError}){
  let gesture,suppressClick=false
  const buttons=[]
  for(const direction of [-1,1])for(const corner of ['top','bottom']){
    const button=document.createElement('button');button.type='button';button.className=`book-corner book-corner-${direction<0?'left':'right'} book-corner-${corner}`;button.dataset.direction=direction;button.hidden=true;area.append(button);buttons.push(button)
    button.addEventListener('pointerdown',event=>{
      if(event.button!==0||!event.isPrimary||gesture||!canStart(direction))return
      event.preventDefault();event.stopPropagation();suppressClick=false
      const bounds=view.getBoundingClientRect()
      gesture={button,id:event.pointerId,start:event.clientX,width:bounds.width,direction,corner,progress:0}
      button.setPointerCapture(event.pointerId)
    })
    button.addEventListener('pointermove',event=>{
      const g=gesture;if(!g||g.id!==event.pointerId)return
      event.preventDefault();event.stopPropagation()
      if(!g.transition&&Math.abs(event.clientX-g.start)>=6){
        try{g.transition=prepare(direction,corner)}catch(error){cancel();onError(error);return}
        if(!g.transition){cancel();return}
      }
      g.progress=dragProgress(g.start,event.clientX,direction,g.width)
      g.transition?.move(g.progress)
    })
    button.addEventListener('pointerup',event=>{
      const g=gesture;if(!g||g.id!==event.pointerId)return
      event.preventDefault();event.stopPropagation();gesture=undefined
      if(button.hasPointerCapture(g.id))button.releasePointerCapture(g.id)
      if(g.transition){suppressClick=true;g.transition.finish(completesDrag(g.progress)).catch(onError)}
      // A click without a drag is handled below, including keyboard activation.
    })
    for(const type of ['pointercancel','lostpointercapture'])button.addEventListener(type,event=>{if(gesture?.id===event.pointerId)cancel()})
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(suppressClick&&event.detail){suppressClick=false;return}if(canStart(direction))Promise.resolve(navigate(direction)).catch(onError)})
  }
  function cancel(){
    const g=gesture;gesture=undefined
    if(g){suppressClick=true;if(g.button.hasPointerCapture(g.id))g.button.releasePointerCapture(g.id);g.transition?.cancel()}
  }
  function update(){
    cancel()
    const active=settings.appearance==='book'&&settings.bookCornerDrag&&settings.readingFlow==='paginated'&&Boolean(view.renderer)
    document.querySelector('#book-drag-field').hidden=settings.appearance!=='book'
    for(const button of buttons){button.hidden=!active;button.setAttribute('aria-label',t(Number(button.dataset.direction)<0?'Página anterior':'Página siguiente'));button.title=t('Arrastra una esquina; suelta a mitad de camino para pasar página o vuelve atrás para cancelar.')}
  }
  document.addEventListener('keydown',event=>{if(gesture&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancel()}},true)
  document.addEventListener('pointerdown',event=>{if(gesture&&event.pointerId!==gesture.id)cancel()},true)
  for(const type of ['resize','blur'])window.addEventListener(type,cancel)
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel()})
  return {update,cancel}
}
