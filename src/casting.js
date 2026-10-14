export const DEFAULT_RECEIVER='CC1AD845'
export function bridgeURL(value){
 const url=new URL(value)
 if(!['localhost','127.0.0.1'].includes(url.hostname)||url.protocol!=='http:'||url.username||url.password||url.search||url.hash)throw new Error('Usa el servicio local de emisión en localhost.')
 return url.href.replace(/\/$/,'')
}
export function mediaURL(value){
 const url=new URL(value)
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.hash||url.hostname==='localhost'||url.hostname==='127.0.0.1'||url.hostname==='[::1]')throw new Error('El receptor necesita una dirección de red accesible, no localhost ni una URL blob.')
 return url.href
}
export function safePresentation(input={}){
 const clean=value=>String(value??'').slice(0,200)
 const cues=Array.isArray(input.cues)?input.cues.slice(0,5000).flatMap(cue=>cue&&Number.isFinite(cue.start)&&Number.isFinite(cue.end)&&cue.start>=0&&cue.end>cue.start&&cue.end<86400?[{start:cue.start,end:cue.end,text:String(cue.text??'').slice(0,2000)}]:[]):[]
 return {title:clean(input.title),chapter:clean(input.chapter),author:clean(input.author),language:['es','ca','en','fr','de','pt','it','zh','ja','hi'].includes(input.language)?input.language:'es',text:String(input.text??'').slice(0,20000),cues,colors:Array.isArray(input.colors)&&input.colors.length===3&&input.colors.every(color=>/^#[a-f\d]{6}$/i.test(color))?input.colors:['#151a18','#e7e8dd','#a5b59a']}
}
export function cueAt(cues,time){return cues.find(cue=>time>=cue.start&&time<cue.end)?.text??''}
let sdk
export function loadCastSDK(){
 if(globalThis.cast?.framework&&globalThis.chrome?.cast)return Promise.resolve()
 if(sdk)return sdk
 sdk=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Google Cast no está disponible en este navegador.')),20000)
  globalThis.__onGCastApiAvailable=available=>{clearTimeout(timer);available?resolve():reject(new Error('Google Cast no está disponible en este navegador.'))}
  const script=document.createElement('script');script.src='https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';script.onerror=()=>{clearTimeout(timer);reject(new Error('No se pudo cargar Google Cast.'))};document.head.append(script)
 }).catch(error=>{sdk=null;throw error});return sdk
}
export class CastSender{
 async connect(appId=DEFAULT_RECEIVER){
  if(!/^[a-f\d]{8}$/i.test(appId))throw new Error('El identificador Cast debe tener ocho caracteres hexadecimales.')
  await loadCastSDK();this.context=cast.framework.CastContext.getInstance()
  this.context.setOptions({receiverApplicationId:appId,autoJoinPolicy:chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,resumeSavedSession:false})
  await this.context.requestSession();this.session=this.context.getCurrentSession()
  if(!this.session)throw new Error('No se ha conectado ningún dispositivo.')
  this.player=new cast.framework.RemotePlayer();this.controller=new cast.framework.RemotePlayerController(this.player)
 }
 async load(url,type,presentation){
  if(!this.session)throw new Error('Conecta primero un dispositivo.')
  const info=new chrome.cast.media.MediaInfo(mediaURL(url),type);info.metadata=new chrome.cast.media.MusicTrackMediaMetadata();info.metadata.title=presentation.title;info.metadata.artist=presentation.author;info.metadata.albumName=presentation.chapter;info.customData={lector:safePresentation(presentation)}
  const request=new chrome.cast.media.LoadRequest(info);request.autoplay=true;await this.session.loadMedia(request)
 }
 pause(){if(this.player&&!this.player.isPaused)this.controller.playOrPause()}
 play(){if(this.player?.isPaused)this.controller.playOrPause()}
 seek(seconds){if(this.player){this.player.currentTime=Math.max(0,seconds);this.controller.seek()}}
 disconnect(){this.context?.endCurrentSession(true);this.session=null}
}
