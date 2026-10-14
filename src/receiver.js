import './receiver.css'
import {safePresentation,cueAt} from './casting.js'
import {t,detectLanguage} from './i18n.js'
const $=id=>document.getElementById(id),audio=$('audio');let presentation=safePresentation(),language=detectLanguage(),timer,lastCommand=0
const status=text=>$('status').textContent=t(text,language)
function show(input){
 presentation=safePresentation(input);language=presentation.language
 document.documentElement.lang=language
 for(const [name,color]of ['background','ink','accent'].map((key,i)=>[key,presentation.colors[i]]))document.documentElement.style.setProperty(`--${name}`,color)
 for(const key of ['title','chapter','author'])$(key).textContent=presentation[key]
 $('passage').textContent=presentation.text;$('fullscreen').setAttribute('aria-label',t('Pantalla completa',language))
}
function progress(time,duration){
 $('progress').value=duration>0?time/duration:0;$('time').textContent=`${Math.floor(time/60)}:${String(Math.floor(time%60)).padStart(2,'0')}`
 if(presentation.cues.length)$('passage').textContent=cueAt(presentation.cues,time)
}
$('fullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.()
audio.ontimeupdate=()=>progress(audio.currentTime,audio.duration)
audio.onerror=()=>status('No se pudo reproducir el audio.')
audio.onplay=()=>status('Reproduciendo');audio.onpause=()=>status('En pausa');audio.onended=()=>status('Audio terminado')
const token=location.hash.slice(1)
if(/^[A-Za-z0-9_-]{32}$/.test(token)){
 // Token never enters query strings, analytics, storage or third-party requests.
 const url=`/session/${token}`
 async function poll(){
  try{
   const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error()
   const session=await response.json()
   if(!audio.getAttribute('src')&&session.ready){show(session.presentation);audio.src=`/media/${token}`;status('Pulsa reproducir en el receptor.')}
   for(const command of session.commands??[]){if(command.sequence<=lastCommand)continue;lastCommand=command.sequence
    if(command.action==='pause')audio.pause()
    if(command.action==='play')await audio.play().catch(()=>status('Pulsa reproducir en el receptor.'))
    if(command.action==='seek'&&Number.isFinite(command.seconds))audio.currentTime=Math.max(0,command.seconds)
   }
   timer=setTimeout(poll,1500)
  }catch{audio.pause();audio.removeAttribute('src');audio.load();status('La emisión ha terminado o ha caducado.')}
 }
 status('Conectando receptor…');poll()
}else if(!token){
 audio.hidden=true;status('Esperando una emisión Cast…')
 // Only the dedicated Cast route loads CAF; LAN browser receivers remain offline.
 const script=document.createElement('script');script.src='https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js'
 script.onload=()=>{
  try{
   const player=document.createElement('cast-media-player');player.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;opacity:0';document.body.append(player)
   const context=cast.framework.CastReceiverContext.getInstance(),manager=context.getPlayerManager()
   manager.setMessageInterceptor(cast.framework.messages.MessageType.LOAD,request=>{show(request.media?.customData?.lector??{title:request.media?.metadata?.title,chapter:request.media?.metadata?.albumName,author:request.media?.metadata?.artist,language});$('cast-progress').hidden=false;return request})
   manager.addEventListener(cast.framework.events.EventType.TIME_UPDATE,()=>progress(manager.getCurrentTimeSec(),manager.getDurationSec()))
   manager.addEventListener(cast.framework.events.EventType.PLAYING,()=>status('Reproduciendo'))
   manager.addEventListener(cast.framework.events.EventType.PAUSE,()=>status('En pausa'))
   manager.addEventListener(cast.framework.events.EventType.ERROR,()=>status('No se pudo reproducir el audio.'))
   context.start({disableIdleTimeout:true})
  }catch{status('Google Cast no está disponible en este navegador.')}
 };script.onerror=()=>status('Google Cast no está disponible en este navegador.');document.head.append(script)
}else status('Enlace de emisión no válido.')
window.addEventListener('pagehide',()=>clearTimeout(timer))
