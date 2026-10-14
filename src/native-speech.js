// A Web Speech shaped adapter, backed by the device's real speech engine.
export async function nativeSpeechAdapter(engine,{target=globalThis}={}) {
  const events=new EventTarget(),utterances=new Map();let voices=[],paused=false,active
  class Utterance extends EventTarget {
    constructor(text=''){super();Object.assign(this,{text,lang:'',voice:null,rate:1,pitch:1,volume:1})}
  }
  function emit(utterance,type,details={}){const event=Object.assign(new Event(type),details);utterance['on'+type]?.(event);utterance.dispatchEvent(event)}
  const listener=await engine.addListener('speechEvent',data=>{
    if(data.type==='action'){target.dispatchEvent(new CustomEvent('lector-media-action',{detail:data.action}));return}
    const utterance=utterances.get(data.id);if(!utterance)return
    emit(utterance,data.type,{name:'word',charIndex:data.charIndex??0,charLength:data.charLength??0,error:data.error??''})
    if(['end','error'].includes(data.type)){utterances.delete(data.id);if(active===data.id){active=null;paused=false}}
  })
  async function refresh(){try{voices=(await engine.voices()).voices??[]}catch{voices=[]}events.dispatchEvent(new Event('voiceschanged'))}
  await refresh()
  const synthesis={
    getVoices:()=>[...voices],
    addEventListener:(...args)=>events.addEventListener(...args),removeEventListener:(...args)=>events.removeEventListener(...args),
    get speaking(){return Boolean(active)},get paused(){return paused},get pending(){return utterances.size>0},
    speak(utterance){const id=crypto.randomUUID();active=id;utterances.set(id,utterance)
      engine.speak({id,text:utterance.text,language:utterance.lang,voice:utterance.voice?.voiceURI??'',rate:utterance.rate,pitch:utterance.pitch,volume:utterance.volume,paused}).then(()=>{if(active===id&&paused)return engine.pause()}).catch(()=>{if(utterances.has(id)){emit(utterance,'error',{error:'native-engine-unavailable'});utterances.delete(id);if(active===id)active=null}})
    },
    cancel(){utterances.clear();active=null;paused=false;engine.cancel().catch(()=>{})},
    pause(){if(!active||paused)return;paused=true;engine.pause().catch(()=>{})},
    resume(){if(!active||!paused)return;paused=false;engine.resume().catch(()=>{})},
  }
  return {synthesis,Utterance,refresh,dispose:()=>{synthesis.cancel();listener.remove()}}
}
