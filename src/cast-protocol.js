// Only bounded audio fragments travel over the authenticated Cast session.
// No network listener, public media URL, credentials or book file is involved.
export const CAST_NAMESPACE='urn:x-cast:io.github.alejandropico.lector.audio'
export const CHUNK_BYTES=12288,MAX_AUDIO_BYTES=8*1024*1024
export const validAppId=value=>typeof value==='string'&&/^[A-F0-9]{8}$/.test(value)&&value!=='CC1AD845'
export const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(value)
export const audioMime=value=>['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/webm','audio/mp4'].includes(value)
export function bytes64(bytes){let text='';for(let i=0;i<bytes.length;i+=CHUNK_BYTES)text+=String.fromCharCode(...bytes.subarray(i,i+CHUNK_BYTES));return btoa(text)}
export function from64(text){if(typeof text!=='string'||text.length>CHUNK_BYTES*4/3||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text))throw Error('Invalid chunk');return Uint8Array.from(atob(text),c=>c.charCodeAt(0))}
export async function digest(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('')}
export function castMetadata(input={}){
  const text=(key,max)=>typeof input[key]==='string'?input[key].slice(0,max):''
  const cover=typeof input.cover==='string'&&input.cover.length<=16000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(input.cover)?input.cover:''
  return {title:text('title',400),author:text('author',400),chapter:text('chapter',300),text:text('text',3000),language:text('language',12),cover}
}
export class AudioReceiver {
  constructor({send,play,control,onMetadata=()=>{},now=()=>Date.now()}){Object.assign(this,{send,play,control,onMetadata,now});this.owner=null;this.pending=null;this.active=null}
  reply(sender,data){this.send(sender,{v:1,...data})}
  status(data){if(this.owner&&this.active)this.reply(this.owner,{type:'state',id:this.active,...data})}
  release(sender){if(this.owner!==sender)return;this.control('stop');this.owner=this.pending=this.active=null;clearTimeout(this.expiry)}
  async receive(sender,message){
    if(!sender||!message||message.v!==1)return
    const m=message
    if(m.type==='hello'){this.reply(sender,{type:'ready',protocol:1});return}
    if(!validId(m.id))return
    const reject=()=>this.reply(sender,{type:'error',id:m.id})
    if(this.owner&&this.owner!==sender){reject();return}
    try{
      if(m.type==='begin'){
        if(this.pending||this.active){reject();return}
        if(!Number.isSafeInteger(m.size)||m.size<1||m.size>MAX_AUDIO_BYTES||!audioMime(m.mime)||!Number.isFinite(m.rate)||m.rate<.25||m.rate>4)throw Error('Invalid fragment')
        this.control('stop');this.owner=sender;this.active=null
        this.pending={id:m.id,size:m.size,mime:m.mime,rate:m.rate,metadata:castMetadata(m.metadata),chunks:[],received:0,part:0,started:this.now()}
        clearTimeout(this.expiry);this.expiry=setTimeout(()=>{if(this.pending?.id===m.id){this.pending=null;reject()}},120000)
        this.reply(sender,{type:'ack',id:m.id,part:-1});return
      }
      if(m.type==='chunk'){
        const p=this.pending;if(!p||p.id!==m.id||m.part!==p.part||this.now()-p.started>120000)throw Error('Invalid sequence')
        const bytes=from64(m.data),expected=Math.min(CHUNK_BYTES,p.size-p.received)
        if(!expected||bytes.length!==expected)throw Error('Invalid chunk size')
        p.chunks.push(bytes);p.received+=bytes.length;p.part++;this.reply(sender,{type:'ack',id:m.id,part:m.part});return
      }
      if(m.type==='commit'){
        const p=this.pending;if(!p||p.id!==m.id||p.received!==p.size||!/^[a-f0-9]{64}$/.test(m.digest))throw Error('Incomplete fragment')
        const bytes=new Uint8Array(p.size);let offset=0;for(const chunk of p.chunks){bytes.set(chunk,offset);offset+=chunk.length}
        if(await digest(bytes)!==m.digest||this.pending!==p)throw Error('Integrity check failed')
        clearTimeout(this.expiry);this.pending=null;this.active=m.id;this.onMetadata(p.metadata)
        await this.play(new Blob([bytes],{type:p.mime}),p.rate,p.metadata)
        if(this.active===m.id)this.reply(sender,{type:'ack',id:m.id,part:-2});return
      }
      if(m.id!==this.active&&m.id!==this.pending?.id)return
      if(m.type==='stop'){this.control('stop');this.pending=this.active=null;clearTimeout(this.expiry)}
      else if(['pause','play','seek'].includes(m.type)&&m.id===this.active){if(m.type==='seek'&&(!Number.isFinite(m.time)||m.time<0))throw Error('Invalid time');await this.control(m.type,m.time)}
    }catch{if(this.pending?.id===m.id){this.pending=null;clearTimeout(this.expiry)}if(this.active===m.id){this.control('stop');this.active=null}reject()}
  }
}
