export const narrationProfiles=[
 {id:'neutral',label:'Natural',rate:1,pitch:1,prompt:''},
 {id:'calm',label:'Calma',rate:.9,pitch:.95,prompt:'Read calmly, with gentle pauses and a warm, relaxed delivery.'},
 {id:'expressive',label:'Expresiva',rate:1,pitch:1.05,prompt:'Read expressively, respecting the emotional context, dialogue and punctuation. Avoid exaggeration.'},
 {id:'documentary',label:'Documental',rate:.98,pitch:1,prompt:'Use a clear, measured documentary narration with careful articulation.'},
 {id:'bedtime',label:'Para dormir',rate:.82,pitch:.92,prompt:'Read softly and slowly, with soothing, restful phrasing.'},
 {id:'custom',label:'Personalizada',rate:1,pitch:1,prompt:''},
]
const clamp=(value,min,max,fallback)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):fallback))
export function safeCast(input={}){
 const characters=(Array.isArray(input.characters)?input.characters:[]).slice(0,100).filter(item=>typeof item?.id==='string'&&/^(?:narrator|actor-[a-z0-9-]+)$/.test(item.id)).map(item=>({id:item.id,name:String(item.name??'').slice(0,60),voice:String(item.voice??'').slice(0,300),apiVoice:String(item.apiVoice??'').slice(0,100),elevenVoice:String(item.elevenVoice??'').slice(0,100),localVoice:String(item.localVoice??'').slice(0,160),localSpeaker:item.localSpeaker==null||item.localSpeaker===''?null:Math.round(clamp(item.localSpeaker,0,999,0)),rate:clamp(item.rate,.5,2,1),pitch:clamp(item.pitch,.5,1.5,1),instructions:String(item.instructions??'').slice(0,1000)}))
 if(!characters.some(item=>item.id==='narrator'))characters.unshift({id:'narrator',name:'',rate:1,pitch:1,localSpeaker:null})
 const ids=new Set(characters.map(item=>item.id))
 const assignments=(Array.isArray(input.assignments)?input.assignments:[]).slice(-2000).filter(item=>typeof item?.cfi==='string'&&item.cfi.startsWith('epubcfi(')&&ids.has(item.characterId)).map(item=>({id:String(item.id??''),cfi:item.cfi.slice(0,4000),characterId:item.characterId,quote:String(item.quote??'').slice(0,1500)}))
 return {characters,assignments}
}
export function narrationSettings(settings,cast,characterId='narrator'){
 const profile=narrationProfiles.find(item=>item.id===settings.narrationProfile)??narrationProfiles[0]
 const character=settings.narrationEnabled?safeCast(cast).characters.find(item=>item.id===characterId):null
 const result={...settings,rate:clamp(settings.rate*profile.rate*(character?.rate??1),.5,2,1),pitch:clamp(settings.pitch*profile.pitch*(character?.pitch??1),.5,1.5,1)}
 for(const key of ['voice','apiVoice','elevenVoice','localVoice'])if(character?.[key])result[key]=character[key]
 if(character?.localSpeaker!=null)result.localSpeaker=character.localSpeaker
 const prompt=[settings.instructions,profile.prompt,profile.id==='custom'?settings.narrationPrompt:'',character?.instructions].filter(Boolean).join('\n')
 result.instructions=prompt+'\nRead exactly the supplied text. Do not add, omit, summarize or translate it.'
 return result
}
function offsetAt(segment,range,boundary){
 let low=0,high=segment.text.length
 while(low<high){const mid=Math.floor((low+high)/2),point=segment.wordRange(mid,1);if(!point)return low;const cmp=point.compareBoundaryPoints(boundary,range);if(cmp<0)low=mid+1;else high=mid}
 return low
}
// Partition at actual DOM boundaries, not repeated quote strings. A later
// correction wins only on its overlap; text and word offsets remain intact.
export function castSegments(segment,index,cast,view,enabled){
 if(!enabled)return [{...segment,characterId:'narrator'}]
 const doc=segment.range.startContainer.ownerDocument,overrides=[]
 for(const item of safeCast(cast).assignments){
  try{
   const target=view.resolveNavigation(item.cfi);if(target?.index!==index)continue
   const range=target.anchor?.(doc);if(!range||range.compareBoundaryPoints(Range.START_TO_END,segment.range)<=0||range.compareBoundaryPoints(Range.END_TO_START,segment.range)>=0)continue
   const start=offsetAt(segment,range,Range.START_TO_START)
   const end=offsetAt(segment,range,Range.END_TO_START)
   if(end>start)overrides.push({...item,start,end})
  }catch{/* A different edition or missing anchor never changes unrelated text. */}
 }
 const cuts=[...new Set([0,segment.text.length,...overrides.flatMap(item=>[item.start,item.end])])].sort((a,b)=>a-b)
 const spans=cuts.slice(0,-1).map((start,i)=>{const end=cuts[i+1],match=overrides.findLast(item=>start>=item.start&&end<=item.end);return {start,end,characterId:match?.characterId??'narrator'}})
 for(let i=spans.length-1;i>=0;i--){const span=spans[i];if(/[\p{L}\p{N}]/u.test(segment.text.slice(span.start,span.end))||spans.length===1)continue;if(spans[i+1])spans[i+1].start=span.start;else spans[i-1].end=span.end;spans.splice(i,1)}
 return spans.map(({start,end,characterId})=>({...segment,text:segment.text.slice(start,end),range:segment.wordRange(start,end-start),wordRange:(offset,length)=>segment.wordRange(start+offset,length),characterId})).filter(item=>item.text.trim()&&item.range)
}
export function paragraphRange(part,start,end){
 const entries=[...part.offsets].filter(([node])=>node.nodeType===3),first=entries.find(([node,offset])=>offset+node.length>start),last=entries.findLast(([,offset])=>offset<end)
 if(!first||!last)return null
 const range=first[0].ownerDocument.createRange();range.setStart(first[0],Math.max(0,start-first[1]));range.setEnd(last[0],Math.min(last[0].length,end-last[1]));return range
}
const cue='(?:dijo|preguntó|respondió|contestó|murmuró|exclamó|susurró|said|asked|replied|whispered|dit|répondit|fragte|sagte|disse|respondeu|rispose|va dir)'
export function dialogueSuggestions(paragraphs,view,index){
 return paragraphs.slice(0,2000).flatMap(part=>{
  if(!/^\s*[—–«“"-]/.test(part.text))return []
  const named=part.text.match(new RegExp(`${cue}\\s+([\\p{Lu}][\\p{L}’'-]{1,40})`,'u'))
  const firstDash=part.text.search(/\S/),prefix=part.text.slice(firstDash).match(/^[—–«“"-]\s*/)?.[0].length??0
  const attribution=part.text.slice(firstDash+prefix).search(new RegExp(`\\s*[—–]\\s*${cue}`,'u'))
  const start=firstDash+prefix,end=attribution<0?part.text.length:start+attribution,range=paragraphRange(part,start,end)
  return range?[{name:named?.[1]??'',quote:range.toString().slice(0,1500),cfi:view.getCFI(index,range)}]:[]
 }).slice(0,100)
}
export function parsedSpeakerSuggestions(output,paragraphs,view,index,preview=paragraphs.map(part=>part.text).join('\n\n')){
 let data;try{data=JSON.parse(output.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g,''))}catch{throw new Error('El análisis no devolvió interlocutores válidos.')}
 if(!Array.isArray(data))throw new Error('El análisis no devolvió interlocutores válidos.')
 return data.slice(0,100).flatMap(item=>{
  if(typeof item?.quote!=='string'||!item.quote.trim()||item.quote.length>1500||!preview.includes(item.quote)||typeof item.speaker!=='string'||item.speaker.length>60)return []
  const matches=paragraphs.flatMap(part=>{const start=part.text.indexOf(item.quote);if(start<0||part.text.indexOf(item.quote,start+1)>=0)return [];return [{part,start}]})
  if(matches.length!==1)return []
  const {part,start}=matches[0],range=paragraphRange(part,start,start+item.quote.length)
  return range?[{name:item.speaker.trim(),quote:item.quote,cfi:view.getCFI(index,range)}]:[]
 })
}
