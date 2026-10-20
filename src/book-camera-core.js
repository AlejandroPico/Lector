const limit=(value,min,max,fallback=0)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):fallback))
export function cameraGeometry(box,viewport,zoom=100,x=0,y=0){
  const scale=limit(zoom,100,200,100)/100,width=box.width*scale,height=box.height*scale
  const left=box.left+(box.width-width)/2,top=box.top+(box.height-height)/2
  const axis=(start,size,a,b,value)=>{
    if(size<=b-a){const shift=Math.max(a-start,Math.min(0,b-start-size));return {min:shift,max:shift,value:shift}}
    const min=b-start-size,max=a-start
    return {min,max,value:(min+max)/2+limit(value,-100,100)*(max-min)/200}
  }
  const horizontal=axis(left,width,viewport.left,viewport.right,x),vertical=axis(top,height,viewport.top,viewport.bottom,y)
  const tx=scale===1?0:horizontal.value,ty=scale===1?0:vertical.value
  const clip=[viewport.top-top-ty,left+tx+width-viewport.right,top+ty+height-viewport.bottom,viewport.left-left-tx].map(n=>Math.max(-32,n/scale))
  return {scale,tx,ty,horizontal,vertical,clip}
}
export function cameraPanFor(geometry,tx,ty){
  const value=(axis,n)=>axis.max>axis.min?limit((n-(axis.min+axis.max)/2)*200/(axis.max-axis.min),-100,100):0
  return {x:value(geometry.horizontal,tx),y:value(geometry.vertical,ty)}
}
export function bookCameraRect(rect,scale=1){return {left:rect.left,top:rect.top,width:rect.width/scale,height:rect.height/scale}}
