import {readJSON,writeJSON} from './storage.js'
export function pronunciationRules(input){return(Array.isArray(input)?input:[]).slice(0,100).filter(rule=>typeof rule.from==='string'&&rule.from.trim()&&typeof rule.to==='string'&&rule.to.trim()).map(rule=>({from:rule.from.trim().slice(0,100),to:rule.to.trim().slice(0,200),whole:rule.whole!==false}))}
export function pronounce(text,rules=[],enabled=false){
  if(!enabled||!rules.length)return {text,source:index=>index}
  const matches=[]
  for(const rule of pronunciationRules(rules)){
    let start=0,index
    while((index=text.indexOf(rule.from,start))>=0){start=index+rule.from.length;const end=start
      if(rule.whole&&(/[\p{L}\p{N}_]/u.test(text[index-1]??'')||/[\p{L}\p{N}_]/u.test(text[end]??'')))continue
      matches.push({start:index,end,text:rule.to})
    }
  }
  matches.sort((a,b)=>a.start-b.start||(b.end-b.start)-(a.end-a.start))
  let cursor=0,spoken='',spans=[]
  const append=(value,start,end)=>{spans.push({at:spoken.length,to:spoken.length+value.length,start,end});spoken+=value}
  for(const match of matches){if(match.start<cursor)continue;append(text.slice(cursor,match.start),cursor,match.start);append(match.text,match.start,match.end);cursor=match.end}
  append(text.slice(cursor),cursor,text.length)
  return {text:spoken,source(index){if(index>=spoken.length)return text.length;const span=spans.find(span=>span.at<=index&&span.to>index);return span?span.start+Math.floor((index-span.at)*(span.end-span.start)/(span.to-span.at)):index}}
}
export function spokenSegment(segment,settings){
  const converted=pronounce(segment.text,settings.pronunciations,settings.pronunciationsEnabled)
  return {...segment,text:converted.text,wordRange:(index,length)=>segment.wordRange?.(converted.source(index),Math.max(1,converted.source(index+length)-converted.source(index)))??segment.range}
}
export function audioEstimate(text,settings){
  const characters=[...text].length,words=[...new Intl.Segmenter(settings.language||'es',{granularity:'word'}).segment(text)].filter(item=>item.isWordLike).length
  const minutes=words/Math.max(80,Number(settings.narrationWpm)||170)
  const price=Math.max(0,Number(settings.voicePrice)||0),base=(settings.voicePriceUnit==='minutes'?minutes:characters/1000)*price
  // Duration pricing is inherently approximate; use the selected reserve factor.
  return {characters,minutes,cost:base*Math.max(1,Number(settings.costMargin)||1)}
}
export class AudioBudget{
 constructor(getSettings,onChange=()=>{}){this.settings=getSettings;this.onChange=onChange}
 usage(){const stored=readJSON('lector-audio-usage',{}),buckets=Object.values(stored);return {cost:Math.max(0,Number(stored[this.settings().voiceCurrency]?.cost)||0),characters:buckets.reduce((sum,item)=>sum+Math.max(0,Number(item?.characters)||0),0),requests:buckets.reduce((sum,item)=>sum+Math.max(0,Number(item?.requests)||0),0),unpriced:buckets.reduce((sum,item)=>sum+Math.max(0,Number(item?.unpriced)||0),0)}}
 reserve(text){const settings=this.settings(),estimate=audioEstimate(text,settings),usage=this.usage()
   if(settings.costLimitEnabled&&!(settings.voicePrice>0))throw new Error('Configura una tarifa positiva antes de activar el límite estimado.')
   if(settings.costLimitEnabled&&usage.cost+estimate.cost>settings.costLimit+1e-9)throw new Error('Se alcanzaría el límite de gasto estimado. No se ha enviado este fragmento.')
   if(settings.characterLimitEnabled&&usage.characters+estimate.characters>settings.characterLimit)throw new Error('Se alcanzaría el límite de caracteres. No se ha enviado este fragmento.')
   const stored=readJSON('lector-audio-usage',{}),prior=stored[settings.voiceCurrency]??{};stored[settings.voiceCurrency]={cost:usage.cost+estimate.cost,characters:(prior.characters||0)+estimate.characters,requests:(prior.requests||0)+1,unpriced:(prior.unpriced||0)+(settings.voicePrice>0?0:1)}
   if(!writeJSON('lector-audio-usage',stored)&&(settings.costLimitEnabled||settings.characterLimitEnabled))throw new Error('No se pudo guardar el contador de voz. Revisa el almacenamiento antes de continuar.')
   this.onChange();return estimate
 }
 reset(){writeJSON('lector-audio-usage',{});this.onChange()}
}
export class SleepTimer{
 constructor(onExpire,onChange=()=>{}){this.onExpire=onExpire;this.onChange=onChange}
 arm(minutes){if(this.deadline)return;this.deadline=Date.now()+minutes*60000;this.interval=setInterval(()=>{if(Date.now()>=this.deadline){this.clear();this.onExpire()}else this.onChange()},500);this.onChange()}
 remaining(){return this.deadline?Math.max(0,this.deadline-Date.now()):0}
 clear(){clearInterval(this.interval);this.deadline=0;this.onChange()}
}
export function waveHeader(samples,rate=24000){const data=new ArrayBuffer(44),view=new DataView(data);const text=(offset,value)=>[...value].forEach((char,index)=>view.setUint8(offset+index,char.charCodeAt(0)));text(0,'RIFF');view.setUint32(4,36+samples*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples*2,true);return data}
export function pcmMono(buffer,rate=24000){const length=Math.round(buffer.length*rate/buffer.sampleRate),output=new ArrayBuffer(length*2),view=new DataView(output),channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));for(let index=0;index<length;index++){const position=index*buffer.sampleRate/rate,low=Math.floor(position),high=Math.min(buffer.length-1,low+1),fraction=position-low;let sample=0;for(const channel of channels)sample+=((channel[low]??0)*(1-fraction)+(channel[high]??0)*fraction)/channels.length;sample=Math.max(-1,Math.min(1,sample));view.setInt16(index*2,Math.round(sample*(sample<0?32768:32767)),true)}return output}
