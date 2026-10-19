// A Web Speech shaped adapter, backed by the device's real speech engine.
export async function nativeSpeechAdapter(engine,{target=globalThis,queue=false}={}) {
  const events=new EventTarget(),utterances=new Map();let voices=[],paused=false,active,reading
  class Utterance extends EventTarget {
    constructor(text=''){super();Object.assign(this,{text,lang:'',voice:null,rate:1,pitch:1,volume:1})}
  }
  function emit(utterance,type,details={}){const event=Object.assign(new Event(type),details);utterance['on'+type]?.(event);utterance.dispatchEvent(event)}
  function receive(data){
    if(data.type==='action'){target.dispatchEvent(new CustomEvent('lector-media-action',{detail:data.action}));return}
    if(reading&&data.id===reading.id){
      if(data.state)paused=data.state==='paused'
      if(['boundary','start','position','state'].includes(data.type)){reading.onPosition?.(data);reading.onState?.(data.state);return}
      if(['end','error','stopped'].includes(data.type)){
        const current=reading;reading=null;active=null;paused=false
        if(data.type==='error')current.reject(new Error(data.error||'native-engine-unavailable'))
        else {current.onStop?.(data);current.resolve()}
      }return
    }
    const utterance=utterances.get(data.id);if(!utterance)return
    if(data.type==='state'){paused=data.state==='paused';return}
    if(data.type==='stopped')data={...data,type:'end'}
    emit(utterance,data.type,{name:'word',charIndex:data.charIndex??0,charLength:data.charLength??0,error:data.error??''})
    if(['end','error'].includes(data.type)){utterances.delete(data.id);if(active===data.id){active=null;paused=false}}
  }
  const listener=await engine.addListener('speechEvent',receive)
  async function refresh(){try{voices=(await engine.voices()).voices??[]}catch{voices=[]}events.dispatchEvent(new Event('voiceschanged'))}
  await refresh()
  const synthesis={
    getVoices:()=>[...voices],
    addEventListener:(...args)=>events.addEventListener(...args),removeEventListener:(...args)=>events.removeEventListener(...args),
    get speaking(){return Boolean(active)},get paused(){return paused},get pending(){return utterances.size>0},
    speak(utterance){const id=crypto.randomUUID();active=id;utterances.set(id,utterance)
      engine.speak({id,text:utterance.text,language:utterance.lang,voice:utterance.voice?.voiceURI??'',rate:utterance.rate,pitch:utterance.pitch,volume:utterance.volume,paused}).then(()=>{if(active===id&&paused)return engine.pause()}).catch(()=>{if(utterances.has(id)){emit(utterance,'error',{error:'native-engine-unavailable'});utterances.delete(id);if(active===id)active=null}})
    },
    cancel(){utterances.clear();active=null;paused=false;if(reading){const prior=reading;reading=null;prior.resolve()}engine.cancel().catch(()=>{})},
    pause(){if(!active||paused)return;paused=true;engine.pause().catch(()=>{})},
    resume(){if(!active||!paused)return;paused=false;engine.resume().catch(()=>{})},
  }
  if(queue)Object.assign(synthesis,{
    startQueue(options,{onPosition,onState,onStop}={}){
      const id=crypto.randomUUID();active=id;paused=Boolean(options.paused)
      return new Promise((resolve,reject)=>{reading={id,resolve,reject,onPosition,onState,onStop};engine.startQueue({...options,id}).catch(error=>{if(reading?.id!==id)return;reading=null;active=null;paused=false;reject(error)})})
    },
    rewind:()=>engine.rewind(),
    configure:options=>engine.configure(options),
    async sync(){const data=await engine.status();if(reading){if(data.state==='stopped')receive({...data,id:reading.id,type:data.error?'error':'end'});else if(data.id===reading.id)receive({...data,type:'position'})}},
  })
  return {synthesis,Utterance,refresh,dispose:()=>{synthesis.cancel();listener.remove()}}
}
