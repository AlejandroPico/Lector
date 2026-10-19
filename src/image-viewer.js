// A viewport with the image's exact aspect ratio. No scrollbars or surrounding frame.
export function attachImageGestures(stage,image,{onChange=()=>{}}={}) {
  let width=1,height=1,scale=1,x=0,y=0,gesture
  const pointers=new Map(),dialog=stage.closest('dialog')
  const clamp=()=>{x=Math.max(width*(1-scale),Math.min(0,x));y=Math.max(height*(1-scale),Math.min(0,y))}
  function update(){clamp();image.style.transform=`translate(${x}px, ${y}px) scale(${scale})`;image.style.cursor=scale>1?'grab':'zoom-in';stage.dataset.zoom=String(scale);onChange(scale)}
  function fit(){
    if(!image.naturalWidth||!image.naturalHeight)return
    const viewport=globalThis.visualViewport,factor=Math.min(((viewport?.width??innerWidth)-32)/image.naturalWidth,((viewport?.height??innerHeight)-32)/image.naturalHeight)
    width=Math.max(1,image.naturalWidth*factor);height=Math.max(1,image.naturalHeight*factor)
    dialog.style.width=`${width}px`;dialog.style.height=`${height}px`;scale=1;x=y=0;pointers.clear();gesture=null;update()
  }
  function zoom(next,atX=width/2,atY=height/2){const previous=scale;scale=Math.max(1,Math.min(8,next));x=atX-(atX-x)*scale/previous;y=atY-(atY-y)*scale/previous;update()}
  stage.addEventListener('wheel',event=>{event.preventDefault();const rect=stage.getBoundingClientRect();zoom(scale*Math.exp(-Math.max(-100,Math.min(100,event.deltaY))*.003),event.clientX-rect.left,event.clientY-rect.top)},{passive:false})
  image.addEventListener('dragstart',event=>event.preventDefault())
  const center=()=>{const values=[...pointers.values()];return {x:values.reduce((n,p)=>n+p.x,0)/values.length,y:values.reduce((n,p)=>n+p.y,0)/values.length,distance:values.length>1?Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y):0}}
  function anchor(){if(!pointers.size){gesture=null;return}const middle=center(),rect=stage.getBoundingClientRect();gesture={...middle,x:middle.x-rect.left,y:middle.y-rect.top,scale,panX:x,panY:y}}
  stage.addEventListener('pointerdown',event=>{if(event.button!==0||pointers.size>=2)return;event.preventDefault();pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});try{stage.setPointerCapture(event.pointerId)}catch{}anchor()})
  stage.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId)||!gesture)return
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});const middle=center(),rect=stage.getBoundingClientRect()
    scale=Math.max(1,Math.min(8,gesture.scale*(pointers.size>1?middle.distance/Math.max(1,gesture.distance):1)))
    x=middle.x-rect.left-(gesture.x-gesture.panX)*scale/gesture.scale;y=middle.y-rect.top-(gesture.y-gesture.panY)*scale/gesture.scale
    update();image.style.cursor='grabbing'
  })
  const end=event=>{pointers.delete(event.pointerId);anchor();update()}
  for(const type of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(type,end)
  stage.addEventListener('dblclick',event=>{const rect=stage.getBoundingClientRect();if(scale>1)fit();else zoom(2,event.clientX-rect.left,event.clientY-rect.top)})
  dialog.addEventListener('keydown',event=>{
    if(['+','=','-','0','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
      event.preventDefault();event.stopPropagation()
      if(event.key==='0')fit();else if(event.key==='+'||event.key==='=')zoom(scale+.25);else if(event.key==='-')zoom(scale-.25)
      else {x+=event.key==='ArrowLeft'?48:event.key==='ArrowRight'?-48:0;y+=event.key==='ArrowUp'?48:event.key==='ArrowDown'?-48:0;update()}
    }
  })
  const resize=()=>{if(dialog.open)fit()};globalThis.addEventListener('resize',resize);globalThis.visualViewport?.addEventListener('resize',resize)
  dialog.addEventListener('close',()=>{pointers.clear();gesture=null})
  return {fit,zoom,scale:()=>scale}
}
