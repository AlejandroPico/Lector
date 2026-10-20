import './cast-receiver.css'
import {CAST_NAMESPACE,AudioReceiver} from './cast-protocol.js'
import {receiverLabels} from './i18n-cast.js'
const audio=document.getElementById('receiver-audio'),state=document.getElementById('receiver-state');let context,player,url,protocol,language='es',lastState=0
const label=key=>(receiverLabels[language]??receiverLabels.es)[key]
state.textContent=label('waiting')
function stop(){audio.pause();audio.removeAttribute('src');audio.load();if(url)URL.revokeObjectURL(url);url=null}
async function initialize(){
  context=cast.framework.CastReceiverContext.getInstance();player=context.getPlayerManager()
  protocol=new AudioReceiver({send:(sender,message)=>{try{context.sendCustomMessage(CAST_NAMESPACE,sender,message)}catch{}},onMetadata:info=>{
    language=info.language.split('-')[0];document.documentElement.lang=language;document.getElementById('receiver-title').textContent=info.title;document.getElementById('receiver-author').textContent=info.author;document.getElementById('receiver-chapter').textContent=info.chapter;document.getElementById('receiver-text').textContent=info.text
    const cover=document.getElementById('receiver-cover');cover.hidden=!info.cover;if(info.cover)cover.src=info.cover;else cover.removeAttribute('src')
  },play:async(blob,rate,info)=>{
    url=URL.createObjectURL(blob)
    const request=new cast.framework.messages.LoadRequestData();request.media=new cast.framework.messages.MediaInformation();request.media.contentId=url;request.media.contentType=blob.type;request.media.streamType=cast.framework.messages.StreamType.BUFFERED;request.media.metadata={metadataType:3,title:info.title,artist:info.author,albumName:info.chapter};request.autoplay=true
    await player.load(request);audio.playbackRate=rate
  },control:(type,time)=>{if(type==='stop'){player?.stop();stop()}else if(type==='pause')audio.pause();else if(type==='play')return audio.play();else if(type==='seek'&&Number.isFinite(audio.duration))audio.currentTime=Math.min(time,audio.duration)}})
  for(const event of ['playing','pause','ended','error','timeupdate'])audio.addEventListener(event,()=>{if(event==='timeupdate'&&performance.now()-lastState<500)return;lastState=performance.now();const status=event==='error'?'error':audio.ended?'ended':audio.paused?'paused':'playing';state.textContent=label(status);protocol.status({state:status,time:audio.currentTime||0,duration:Number.isFinite(audio.duration)?audio.duration:0})})
  context.addCustomMessageListener(CAST_NAMESPACE,event=>{let data=event.data;try{if(typeof data==='string')data=JSON.parse(data)}catch{return}protocol.receive(event.senderId,data)})
  context.addEventListener(cast.framework.system.EventType.SENDER_DISCONNECTED,event=>protocol.release(event.senderId))
  context.start({mediaElement:audio,disableIdleTimeout:false,customNamespaces:{[CAST_NAMESPACE]:cast.framework.system.MessageType.JSON}})
}
// Only the public receiver page loads this SDK; opening Lector does not do so.
if(globalThis.cast?.framework)initialize().catch(()=>state.textContent=label('error'))
else{const script=document.createElement('script');script.src='https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js';script.onload=()=>initialize().catch(()=>state.textContent=label('error'));script.onerror=()=>state.textContent=label('error');document.head.append(script)}
