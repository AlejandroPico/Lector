// Tests the exact listed voice. No automatic fallback, retries, provider calls or saved selection.
export function probeVoice(voice,{synthesis=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance,text,signal,timeout=15000,onStart=()=>{}}={}) {
  if(signal?.aborted)return Promise.resolve({status:'cancelled'})
  const current=synthesis?.getVoices().find(item=>item.voiceURI===voice.voiceURI&&item.lang===voice.lang)
  if(!current||!Utterance)return Promise.resolve({status:'unavailable'})
  return new Promise(resolve=>{
    const utterance=new Utterance(text);let settled=false,timer
    const finish=result=>{
      if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel)
      utterance.onstart=utterance.onend=utterance.onerror=null;resolve(result)
    }
    const cancel=()=>{finish({status:'cancelled'});try{synthesis.cancel()}catch{}}
    utterance.voice=current;utterance.lang=current.lang;utterance.rate=1;utterance.pitch=1;utterance.volume=1
    utterance.onstart=onStart
    utterance.onend=()=>finish({status:'completed'})
    utterance.onerror=event=>finish({status:'failed',error:String(event.error||'unknown').slice(0,80)})
    signal?.addEventListener('abort',cancel,{once:true})
    timer=setTimeout(()=>{finish({status:'timeout'});try{synthesis.cancel()}catch{}},timeout)
    try{synthesis.speak(utterance)}catch(error){finish({status:'failed',error:String(error.name||'unknown').slice(0,80)})}
  })
}

export class VoiceDiagnostics {
  constructor({synthesis=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance,isBusy=()=>false,onLock=()=>{},onResult=()=>{},onStart=()=>{},timeout=15000}={}) {
    Object.assign(this,{synthesis,Utterance,isBusy,onLock,onResult,onStart,timeout})
  }
  get running(){return Boolean(this.controller)}
  cancel(){this.controller?.abort()}
  async start(voices,text){
    if(this.running||this.isBusy()||this.synthesis?.speaking||this.synthesis?.pending||this.synthesis?.paused)throw new Error('Detén la lectura antes de probar varias voces.')
    if(!voices.length||voices.length>25)throw new Error('Selecciona entre 1 y 25 voces.')
    if(typeof text!=='string'||!text.trim()||text.length>200)throw new Error('La muestra admite entre 1 y 200 caracteres.')
    const controller=this.controller=new AbortController(),results=[]
    this.onLock(true)
    try{
      for(const voice of voices){
        if(controller.signal.aborted)break
        if(this.isBusy())break
        const result=await probeVoice(voice,{synthesis:this.synthesis,Utterance:this.Utterance,text,timeout:this.timeout,signal:controller.signal,onStart:()=>this.onStart(voice)})
        results.push({voice,...result});this.onResult(voice,result)
      }
      return results
    }finally{this.controller=undefined;this.onLock(false)}
  }
}
