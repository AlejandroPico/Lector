import './book-binding.css'
import {bookCameraRect} from './book-camera-core.js'

export const bookBindings=['hardcover','paperback','notebook']
export function addBindingControls(){
  document.querySelector('#scene-options').insertAdjacentHTML('beforebegin',`<label id="book-binding-field" class="field" hidden>Encuadernación<select data-setting="bookBinding"><option value="hardcover">Tapa dura</option><option value="paperback">Bolsillo</option><option value="notebook">Cuaderno</option></select></label>`)
  const group=document.createElement('div');group.id='book-format-controls';group.className='book-format-controls';group.hidden=true
  document.querySelector('#paper-light-settings').before(group)
  group.append(document.querySelector('#book-binding-field'),document.querySelector('#mobile-book-field'))
}
export function updateBindingControls(settings){
  document.querySelector('#book-binding-field').hidden=settings.appearance!=='book'
  document.querySelector('#book-format-controls').hidden=settings.appearance!=='book'
  document.body.dataset.bookBinding=bookBindings.includes(settings.bookBinding)?settings.bookBinding:'hardcover'
}

// A cover is one complete board with an outside, lining and spine. It does not
// reuse the two cropped iframe faces used by an ordinary turning sheet.
export async function moveBookCover({area,record,back,opening,navigate,cancelled,settings,onLayer}){
  const layer=document.createElement('div');layer.className='book-turn book-cover-motion';layer.setAttribute('aria-hidden','true');layer.inert=true
  let objectURL,animation,navigated=false
  const navigateOnce=async()=>{if(!navigated){navigated=true;await navigate()}}
  try{
    area.append(layer);onLayer(layer)
    const visible=area.querySelector(back?'.book-back-cover img':'#opening-cover-image')
    const image=new Image()
    if(!back&&record.coverBlob){objectURL=URL.createObjectURL(record.coverBlob);image.src=objectURL}
    else if(visible?.src)image.src=visible.src
    if(image.src)await image.decode().catch(()=>{})
    if(cancelled())return
    const scale=Number(area.dataset.cameraScale)||1,bounds=bookCameraRect(area.getBoundingClientRect(),scale),focused=area.classList.contains('book-focused')
    const ratio=image.naturalWidth&&image.naturalHeight?image.naturalWidth/image.naturalHeight:2/3
    const maxHeight=bounds.height-(back?bounds.height*.06:76)
    const height=Math.max(1,Math.min(maxHeight,bounds.width*(innerWidth<700?.9:.7)/ratio))
    // Read the actual contained image, rather than its object-fit letterbox.
    const element=opening?area.querySelector(back?'.book-back-cover':'#opening-cover-image'):null
    const box=element?.getBoundingClientRect()
    const h=box?Math.min(box.height,box.width/ratio)/scale:height,w=h*ratio
    const x=box?(box.left-bounds.left)/scale+(box.width/scale-w)/2:(bounds.width-w)/2
    const y=box?(box.top-bounds.top+(box.height-h*scale)/2)/scale:back?(bounds.height-h)/2:16
    const board=document.createElement('div');board.className='book-cover-board';board.classList.toggle('cover-hinge-right',back)
    const outside=document.createElement('div');outside.className='book-cover-outside'
    if(image.src)outside.append(image)
    else{const title=document.createElement('span');title.textContent=record.title??'';outside.append(title)}
    const inside=document.createElement('div');inside.className='book-cover-lining'
    const spine=document.createElement('i');spine.className='book-cover-spine'
    board.append(outside,inside,spine);layer.append(board)
    const closedHinge=x+(back?w:0),openWidth=focused?bounds.width:bounds.width/2
    const openHinge=focused?(back?0:bounds.width):bounds.width/2
    board.style.cssText=`left:${closedHinge}px;top:${y}px;width:${w}px;height:${h}px;transform-origin:${back?'right':'left'} center;margin-left:${back?-w:0}px`
    area.classList.add('cover-moving')
    if(opening)await navigateOnce()
    if(cancelled())return
    if(settings.appearance!=='book'||!layer.isConnected){await navigateOnce();return}
    const closed='translate3d(0,0,0) rotateY(0deg) scale(1,1)'
    const open=`translate3d(${openHinge-closedHinge}px,${-y}px,0) rotateY(${back?180:-180}deg) scale(${openWidth/w},${bounds.height/h})`
    animation=board.animate(opening?[{transform:closed},{transform:open}]:[{transform:open},{transform:closed}],{duration:settings.bookBinding==='paperback'?800:1000,easing:'cubic-bezier(.35,.05,.2,1)',fill:'both'})
    // Resizing or switching appearance ends the decoration, never the reading.
    const cancel=()=>animation.cancel();window.addEventListener('resize',cancel,{once:true})
    try{await animation.finished.catch(()=>{})}finally{window.removeEventListener('resize',cancel)}
    if(!cancelled())await navigateOnce()
  }finally{
    animation?.cancel();layer.remove();area.classList.remove('cover-moving');if(objectURL)URL.revokeObjectURL(objectURL)
  }
}
