import {cameraGeometry,cameraPanFor} from './book-camera-core.js'
import {t} from './i18n.js'
import './book-camera.css'
const $=selector=>document.querySelector(selector)
const keys=['bookCameraZoom','bookCameraX','bookCameraY']
export function addCameraControls(){
  $('#paper-light-settings').insertAdjacentHTML('beforebegin',`<details id="book-camera-settings" class="settings-section" hidden><summary>Cámara móvil</summary>
  <label class="field range-field"><span>Zoom del libro <output data-camera-output="bookCameraZoom"></output></span><input type="range" min="100" max="200" step="1" data-setting="bookCameraZoom"></label>
  <label class="field range-field"><span>Encuadre horizontal <output data-camera-output="bookCameraX"></output></span><input type="range" min="-100" max="100" step="1" data-setting="bookCameraX"></label>
  <label class="field range-field"><span>Encuadre vertical <output data-camera-output="bookCameraY"></output></span><input type="range" min="-100" max="100" step="1" data-setting="bookCameraY"></label>
  <div id="camera-spread-presets" class="camera-presets"><button type="button" data-camera-page="left">Encuadrar página izquierda</button><button type="button" data-camera-page="right">Encuadrar página derecha</button></div>
  <label class="check-field"><input id="book-camera-gestures" type="checkbox">Mover el encuadre con gestos</label>
  <p class="small muted">Arrastra para mover y junta o separa dos dedos para ampliar. Termina el encuadre para seleccionar texto.</p>
  <button type="button" id="book-camera-reset" class="text-button">Restablecer cámara</button></details>`)
}
export function createBookCamera({area,view,settings,save,onEdit}){
  const plane=document.createElement('div');plane.className='book-camera-gesture';plane.hidden=true;plane.tabIndex=0;plane.setAttribute('role','group');area.append(plane)
  const exit=document.createElement('button');exit.className='book-camera-exit';exit.hidden=true;exit.type='button';$('#app').append(exit)
  const start=$('#start-reading'),placeholder=document.createElement('span');placeholder.setAttribute('aria-hidden','true')
  let editing=false,geometry,box,viewport,gesture,frame=0
  const pointers=new Map()
  const enabled=()=>settings.appearance==='book'&&matchMedia('(max-width:900px)').matches
  function update(){
    const active=enabled(),controls=$('#book-page-focus'),footer=$('.reading-footer'),zen=document.body.classList.contains('zen')
    const footerHeight=zen?0:footer.getBoundingClientRect().height
    document.documentElement.style.setProperty('--camera-footer-height',`${footerHeight}px`)
    const closedZoom=active&&settings.bookCameraZoom>100&&area.classList.contains('cover-open')
    document.body.classList.toggle('camera-front-focus',closedZoom)
    if(closedZoom&&!start.classList.contains('book-camera-start')){
      placeholder.style.height=start.offsetHeight+'px';start.before(placeholder);$('#app').append(start);start.classList.add('book-camera-start')
    }else if(!closedZoom&&start.classList.contains('book-camera-start')){start.classList.remove('book-camera-start');placeholder.replaceWith(start)}
    const focusTop=Math.min(area.offsetTop+area.offsetHeight+8,innerHeight-footerHeight-82)
    document.documentElement.style.setProperty('--book-focus-top',`${focusTop}px`)
    box={left:area.offsetLeft,top:area.offsetTop,width:area.offsetWidth,height:area.offsetHeight}
    viewport={left:14,right:innerWidth-14,top:zen?20:Math.max(75,$('.toolbar').getBoundingClientRect().bottom+8),bottom:zen?innerHeight-54:Math.min(innerHeight-footerHeight-16,controls.hidden?Infinity:focusTop-12)}
    geometry=cameraGeometry(box,viewport,active?settings.bookCameraZoom:100,settings.bookCameraX,settings.bookCameraY)
    const {scale,tx,ty,clip}=geometry
    area.dataset.cameraScale=String(scale)
    if(view.renderer)view.renderer.dataset.readerScale=String(scale)
    area.style.transform=scale===1?'':`translate(${tx}px,${ty}px) scale(${scale})`
    area.style.clipPath=scale===1?'':`inset(${clip.map(n=>n+'px').join(' ')})`
    $('#book-camera-settings').hidden=!active
    $('#camera-spread-presets').hidden=settings.bookMobileView!=='spread'
    if(!active){editing=false;pointers.clear();gesture=null}
    plane.hidden=exit.hidden=!active||!editing
    $('#book-camera-gestures').checked=editing
    plane.setAttribute('aria-label',t('Encuadrar libro'));exit.textContent=t('Terminar encuadre')
    for(const key of keys){const input=$(`[data-setting="${key}"]`);input.value=settings[key];$(`[data-camera-output="${key}"]`).textContent=`${settings[key]} %`}
    $('[data-setting="bookCameraX"]').disabled=scale===1||geometry.horizontal.max===geometry.horizontal.min
    $('[data-setting="bookCameraY"]').disabled=scale===1||geometry.vertical.max===geometry.vertical.min
  }
  function change(values){
    for(const key of keys)if(Object.hasOwn(values,key))settings[key]=Math.round(Math.min(key==='bookCameraZoom'?200:100,Math.max(key==='bookCameraZoom'?100:-100,Number(values[key])||0)))
    update();save()
  }
  for(const key of keys)$(`[data-setting="${key}"]`).addEventListener('input',event=>{event.stopImmediatePropagation();change({[key]:event.target.value})})
  $('#book-camera-reset').onclick=()=>{editing=false;change({bookCameraZoom:100,bookCameraX:0,bookCameraY:0})}
  for(const button of document.querySelectorAll('[data-camera-page]'))button.onclick=()=>change({bookCameraZoom:200,bookCameraX:button.dataset.cameraPage==='left'?100:-100,bookCameraY:0})
  $('#book-camera-gestures').onchange=event=>{editing=event.target.checked;update();if(editing){onEdit();plane.focus({preventScroll:true})}}
  exit.onclick=()=>{editing=false;pointers.clear();gesture=null;update()}
  const middle=()=>{const p=[...pointers.values()];return {x:p.reduce((n,v)=>n+v.x,0)/p.length,y:p.reduce((n,v)=>n+v.y,0)/p.length,distance:p.length===2?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0}}
  function anchor(){gesture=pointers.size?{...middle(),scale:geometry.scale,tx:geometry.tx,ty:geometry.ty}:null}
  plane.addEventListener('pointerdown',event=>{if(event.button!==0||pointers.size>=2)return;event.preventDefault();event.stopPropagation();plane.focus({preventScroll:true});pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});plane.setPointerCapture(event.pointerId);anchor()})
  plane.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId)||!gesture)return;event.preventDefault();event.stopPropagation();pointers.set(event.pointerId,{x:event.clientX,y:event.clientY})
    const point=middle(),zoom=Math.max(100,Math.min(200,gesture.scale*100*(pointers.size===2?point.distance/Math.max(1,gesture.distance):1))),ratio=zoom/(gesture.scale*100)
    const tx=point.x+(box.left+box.width/2+gesture.tx-gesture.x)*ratio-(box.left+box.width/2),ty=point.y+(box.top+box.height/2+gesture.ty-gesture.y)*ratio-(box.top+box.height/2)
    const pan=cameraPanFor(cameraGeometry(box,viewport,zoom),tx,ty)
    change({bookCameraZoom:zoom,bookCameraX:pan.x,bookCameraY:pan.y})
  })
  for(const type of ['pointerup','pointercancel','lostpointercapture'])plane.addEventListener(type,event=>{pointers.delete(event.pointerId);anchor()})
  plane.addEventListener('click',event=>{event.preventDefault();event.stopPropagation()})
  plane.addEventListener('keydown',event=>{
    const values={'ArrowLeft':['bookCameraX',10],'ArrowRight':['bookCameraX',-10],'ArrowUp':['bookCameraY',10],'ArrowDown':['bookCameraY',-10],'+':['bookCameraZoom',10],'=':['bookCameraZoom',10],'-':['bookCameraZoom',-10]}
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();exit.click()}
    else if(event.key==='0'){event.preventDefault();event.stopPropagation();$('#book-camera-reset').click()}
    else if(values[event.key]){event.preventDefault();event.stopPropagation();const [key,delta]=values[event.key];change({[key]:settings[key]+delta})}
  })
  const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update)});observer.observe(area)
  new MutationObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update)}).observe(area,{attributes:true,attributeFilter:['class']})
  return {update}
}
