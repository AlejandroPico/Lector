import {bytes64,CHUNK_BYTES,MAX_AUDIO_BYTES,audioMime,digest,castMetadata} from './cast-protocol.js'
// An HTMLAudioElement-shaped output. Failed transfers never fall back to a
// different speaker, and every pending operation is cancelled on disposal.
export class CastAudio {
  constructor(route,blob,metadata){this.route=route;this.blob=blob;this.metadata=castMetadata(metadata);this.id=crypto.randomUUID();this.remote=true;this.duration=NaN;this.time=0;this.playbackRate=1;this.paused=true;this.waiters=new Map();this.live=true;this.loaded=false;this.unsubscribe=route.subscribe(message=>this.receive(message));this.disconnected=route.onDisconnect(()=>this.fail())}
  get currentTime(){return this.time}
  set currentTime(value){if(Number.isFinite(value)&&value>=0){this.time=value;if(this.loaded)this.command('seek',{time:value})}}
  receive(m){if(!this.live||m.id!==this.id)return;if(m.type==='error'){this.fail();return}if(m.type==='ack'){this.waiters.get(m.part)?.resolve();return}if(m.type!=='state')return
    if(Number.isFinite(m.time))this.time=Math.max(0,m.time);if(Number.isFinite(m.duration)&&m.duration>0)this.duration=m.duration;this.ontimeupdate?.()
    clearTimeout(this.heartbeat)
    if(m.state==='playing'){this.heartbeat=setTimeout(()=>this.fail(),20000);this.paused=false;this.waiters.get('playing')?.resolve();this.onplaying?.()}
    else if(m.state==='paused'){this.paused=true;this.onpause?.()}
    else if(m.state==='ended')this.onended?.()
    else if(m.state==='error')this.fail()
  }
  wait(part,timeout=15000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.waiters.delete(part);reject(Error('La emisión no pudo continuar.'))},timeout);this.waiters.set(part,{resolve:()=>{clearTimeout(timer);this.waiters.delete(part);resolve()},reject:error=>{clearTimeout(timer);this.waiters.delete(part);reject(error)}})})}
  async exchange(message,part){const result=this.wait(part);result.catch(()=>{});try{await this.route.send({v:1,id:this.id,...message})}catch(error){this.waiters.get(part)?.reject(error)}return result}
  async play(){
    if(!this.live)throw Error('La emisión no pudo continuar.')
    this.pauseRequested=false
    if(this.loading)return this.loading
    if(this.loaded){const playing=this.wait('playing');playing.catch(()=>{});await this.command('play');await playing;return}
    this.loading=this.transfer();try{await this.loading}catch(error){this.dispose();throw error}finally{this.loading=null}
  }
  async transfer(){
    if(!audioMime(this.blob.type)||this.blob.size<1||this.blob.size>MAX_AUDIO_BYTES)throw Error('El fragmento de audio no es compatible con la emisión.')
    const bytes=new Uint8Array(await this.blob.arrayBuffer()),hash=await digest(bytes)
    if(!this.live)throw Error('La emisión no pudo continuar.')
    await this.exchange({type:'begin',size:bytes.length,mime:this.blob.type,rate:this.playbackRate,metadata:this.metadata},-1)
    for(let offset=0,part=0;offset<bytes.length;offset+=CHUNK_BYTES,part++){if(!this.live)throw Error('La emisión no pudo continuar.');await this.exchange({type:'chunk',part,data:bytes64(bytes.subarray(offset,offset+CHUNK_BYTES))},part)}
    const playing=this.wait('playing',30000);playing.catch(()=>{})
    await this.exchange({type:'commit',digest:hash},-2);this.loaded=true;await playing
    if(this.pauseRequested)await this.command('pause')
  }
  pause(){this.pauseRequested=true;this.paused=true;if(this.loaded)this.command('pause')}
  async command(type,data={}){try{if(this.live)await this.route.send({v:1,type,id:this.id,...data})}catch{this.fail()}}
  fail(){if(!this.live)return;this.onerror?.();this.dispose()}
  dispose(){if(!this.live)return;clearTimeout(this.heartbeat);this.route.send({v:1,type:'stop',id:this.id}).catch(()=>{});this.live=false;for(const waiter of [...this.waiters.values()])waiter.reject(Error('La emisión no pudo continuar.'));this.waiters.clear();this.unsubscribe?.();this.disconnected?.()}
}
