import {iconButton} from './icons.js'
import './toolbar-tools.css'

// Keep the original buttons and handlers when switching between desktop and mobile.
export function createToolbarTools({closePanels,closeSidebar}) {
  const toolbar=document.querySelector('.toolbar'),actions=toolbar.querySelector('.toolbar-right')
  const home=document.createComment('desktop toolbar actions');actions.before(home)
  const holder=document.createElement('div');holder.className='toolbar-tools'
  holder.innerHTML=iconButton('tools-toggle','controls','Herramientas','aria-expanded="false" aria-controls="tools-drawer"')
  toolbar.append(holder)
  const trigger=holder.firstElementChild,drawer=document.createElement('aside')
  drawer.id='tools-drawer';drawer.className='tools-drawer';drawer.hidden=true;drawer.inert=true
  drawer.setAttribute('aria-labelledby','tools-title')
  drawer.innerHTML=`<div class="tools-heading"><h2 id="tools-title">Herramientas</h2>${iconButton('tools-close','close','Cerrar')}</div>`
  document.querySelector('#app').append(drawer)
  const media=matchMedia('(max-width: 900px)');let expanded=false,animation
  function close({restore=true,immediate=false}={}){
    if(!expanded&&!immediate)return
    const focus=restore&&drawer.contains(document.activeElement)
    expanded=false;trigger.setAttribute('aria-expanded','false');drawer.inert=true
    animation?.cancel();animation=null
    if(focus&&media.matches)trigger.focus({preventScroll:true})
    if(immediate||matchMedia('(prefers-reduced-motion: reduce)').matches){drawer.hidden=true;return}
    const current=drawer.animate([{transform:'translateX(0)'},{transform:'translateX(100%)'}],{duration:500,easing:'cubic-bezier(.22,.61,.36,1)'})
    animation=current;current.finished.then(()=>{if(animation===current){drawer.hidden=true;animation=null}}).catch(()=>{})
  }
  function open(){
    closePanels();closeSidebar();animation?.cancel();drawer.hidden=false;drawer.inert=false;expanded=true
    trigger.setAttribute('aria-expanded','true')
    const current=drawer.animate([{transform:'translateX(100%)'},{transform:'translateX(0)'}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:500,easing:'cubic-bezier(.22,.61,.36,1)'})
    animation=current;current.finished.then(()=>{if(animation===current)animation=null}).catch(()=>{})
    drawer.querySelector('button').focus({preventScroll:true})
  }
  function layout(){
    const focused=drawer.contains(document.activeElement)||document.activeElement===trigger
    close({restore:false,immediate:true})
    if(media.matches)drawer.append(actions);else home.after(actions)
    if(focused)(media.matches?trigger:actions.querySelector('button')).focus({preventScroll:true})
  }
  trigger.onclick=()=>expanded?close():open()
  drawer.querySelector('#tools-close').onclick=()=>close()
  drawer.addEventListener('click',event=>{if(event.target.closest('.toolbar-right button'))close({restore:false,immediate:true})},true)
  drawer.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return
    const buttons=[...drawer.querySelectorAll('button:not(:disabled)')].filter(button=>button.getClientRects().length)
    const index=buttons.indexOf(document.activeElement)
    if(event.shiftKey&&index===0){event.preventDefault();buttons.at(-1)?.focus()}
    else if(!event.shiftKey&&index===buttons.length-1){event.preventDefault();buttons[0]?.focus()}
  })
  media.addEventListener('change',layout);layout()
  return {close,get compact(){return media.matches}}
}
