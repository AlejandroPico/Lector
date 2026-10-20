import {CAST_NAMESPACE,validAppId} from './cast-protocol.js'
// The official selector owns discovery. There is no manual device list or IP.
export function createWebCast({appId,host=globalThis,onState=()=>{},onError=()=>{}}){
  let context,session,ready=false,device='',initializing
  const listeners=new Set(),disconnects=new Set()
  const message=(_namespace,data)=>{try{const parsed=typeof data==='string'?JSON.parse(data):data;for(const listener of listeners)listener(parsed)}catch{}}
  const ended=()=>{const previous=session;try{previous?.removeMessageListener(CAST_NAMESPACE,message)}catch{}session=null;ready=false;device='';for(const listener of disconnects)listener();onState()}
  async function adopt(candidate){
    if(!candidate||candidate===session)return
    ended();session=candidate;device=candidate.getCastDevice()?.friendlyName??'';candidate.addMessageListener(CAST_NAMESPACE,message)
    // A successful SDK connection is not evidence of protocol/audio support.
    const supported=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{listeners.delete(check);reject(Error('El receptor de Lector no está disponible.'))},10000);const check=m=>{if(m?.v===1&&m.type==='ready'&&m.protocol===1){clearTimeout(timer);listeners.delete(check);resolve()}};listeners.add(check)})
    supported.catch(()=>{})
    try{await candidate.sendMessage(CAST_NAMESPACE,{v:1,type:'hello'});await supported;if(session!==candidate)return;ready=true;onState()}catch{if(session===candidate){context.endCurrentSession(true);ended();onError('El receptor de Lector no está disponible.')}}
  }
  function setup(){const fw=host.cast?.framework;if(!fw||!host.chrome?.cast)throw Error('Google Cast no está disponible en este dispositivo.');context=fw.CastContext.getInstance();context.setOptions({receiverApplicationId:appId,autoJoinPolicy:host.chrome.cast.AutoJoinPolicy.PAGE_SCOPED,resumeSavedSession:false});context.addEventListener(fw.CastContextEventType.SESSION_STATE_CHANGED,event=>{if([fw.SessionState.SESSION_STARTED,fw.SessionState.SESSION_RESUMED].includes(event.sessionState))adopt(context.getCurrentSession());else if([fw.SessionState.SESSION_ENDED,fw.SessionState.SESSION_START_FAILED].includes(event.sessionState))ended()});onState()}
  return {
    get active(){return ready},get device(){return device},get available(){return Boolean(context)},
    initialize(){if(!validAppId(appId))return Promise.resolve(false);if(initializing)return initializing;initializing=new Promise((resolve,reject)=>{if(host.cast?.framework){try{setup();resolve(true)}catch(error){reject(error)}return}const timer=setTimeout(()=>reject(Error('Google Cast no está disponible en este dispositivo.')),15000);host.__onGCastApiAvailable=available=>{clearTimeout(timer);try{if(!available)throw Error('Google Cast no está disponible en este dispositivo.');setup();resolve(true)}catch(error){reject(error)}};const script=host.document.createElement('script');script.src='https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';script.onerror=()=>{clearTimeout(timer);reject(Error('Google Cast no está disponible en este dispositivo.'))};host.document.head.append(script)});return initializing},
    request(){if(!context)throw Error('Google Cast no está disponible en este dispositivo.');return context.requestSession()},
    disconnect(){context?.endCurrentSession(true);ended()},
    send(data){if(!session)return Promise.reject(Error('La emisión no pudo continuar.'));return session.sendMessage(CAST_NAMESPACE,data)},
    subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener)},
    onDisconnect(listener){disconnects.add(listener);return ()=>disconnects.delete(listener)},
  }
}
export async function createAndroidCast({plugin,appId,onState=()=>{},onError=()=>{}}){
  const listeners=new Set(),disconnects=new Set();let active=false,device='',available=false,sequence=0
  await plugin.addListener('message',m=>{for(const listener of listeners)listener(m)})
  const route={get active(){return active},get device(){return device},get available(){return available},request:()=>plugin.request(),disconnect:async()=>{await plugin.disconnect()},send:data=>plugin.send({message:JSON.stringify(data)}),subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener)},onDisconnect(listener){disconnects.add(listener);return ()=>disconnects.delete(listener)}}
  await plugin.addListener('state',async state=>{
    const job=++sequence
    active=false;device=state.device??''
    if(state.connected){let check,timer;const supported=new Promise((resolve,reject)=>{check=m=>{if(m.v===1&&m.type==='ready'&&m.protocol===1){clearTimeout(timer);listeners.delete(check);resolve()}};listeners.add(check);timer=setTimeout(()=>{listeners.delete(check);reject(Error('El receptor de Lector no está disponible.'))},10000)})
      supported.catch(()=>{})
      try{await route.send({v:1,type:'hello'});await supported;if(job===sequence)active=true}catch{if(job===sequence){plugin.disconnect().catch(()=>{});onError('El receptor de Lector no está disponible.')}}
    }else for(const listener of disconnects)listener()
    onState()
  })
  if(validAppId(appId)){try{available=Boolean((await plugin.initialize()).available)}catch{}}
  return route
}
