export function moveFocus(key,root=document) {
  const active=root.activeElement??document.activeElement,origin=active?.getBoundingClientRect?.()
  if(!origin)return false
  const dx=key==='ArrowRight'?1:key==='ArrowLeft'?-1:0,dy=key==='ArrowDown'?1:key==='ArrowUp'?-1:0
  const candidates=[...root.querySelectorAll('button,a,input,select,textarea,summary,[tabindex="0"]')].filter(element=>!element.disabled&&!element.inert&&element!==active&&element.getClientRects().length)
  const cx=origin.x+origin.width/2,cy=origin.y+origin.height/2
  const next=candidates.map(element=>{const box=element.getBoundingClientRect(),x=box.x+box.width/2-cx,y=box.y+box.height/2-cy;return {element,forward:x*dx+y*dy,cross:Math.abs(x*dy+y*dx)}}).filter(item=>item.forward>3).sort((a,b)=>(a.forward+a.cross*3)-(b.forward+b.cross*3))[0]
  next?.element.focus({preventScroll:true});next?.element.scrollIntoView({block:'nearest'});return Boolean(next)
}
export function gamepadKeys(pad) {
  const keys=[],mapping={0:'Enter',1:'Escape',9:'MediaPlayPause',12:'ArrowUp',13:'ArrowDown',14:'ArrowLeft',15:'ArrowRight'}
  for(const [index,key]of Object.entries(mapping))if(pad.buttons[index]?.pressed)keys.push(key)
  if(pad.axes[0]>.65)keys.push('ArrowRight');if(pad.axes[0]<-.65)keys.push('ArrowLeft')
  if(pad.axes[1]>.65)keys.push('ArrowDown');if(pad.axes[1]<-.65)keys.push('ArrowUp')
  return [...new Set(keys)]
}
export function attachGamepad(enabled,dispatch) {
  let timer,held=new Set(),repeated=0
  const poll=()=>{
    if(!enabled()||document.hidden){held.clear();return}
    const keys=new Set([...navigator.getGamepads?.()??[]].filter(Boolean).flatMap(gamepadKeys)),now=performance.now()
    for(const key of keys)if(!held.has(key)||key.startsWith('Arrow')&&now-repeated>260){dispatch(key);repeated=now}
    held=keys
  }
  return {update(){clearInterval(timer);held.clear();if(enabled())timer=setInterval(poll,50)},dispose(){clearInterval(timer)}}
}
