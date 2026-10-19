import {isPersonalScene} from './personal-scene-core.js'
import {annotationColors} from './notes.js'
// Only portable reading data crosses the device boundary. No files or credentials.
export const preferenceKeys=['paperLightEnabled','paperBrightness','paperWarmth','paperInverted','paperCustomColors','paperBackground','paperInk','appearance','bookScene','bookMobileView','coverSize','uiLanguage','theme','customThemes','font','fontSize','lineHeight','paragraphGap','columns','width','gutter','fullWidth','marginOuter','marginInner','justify','animated','hyphenate','readingFlow','showOpeningCover','highlight','highlightMode','followSpeech','clickToRead','showAnnotations','showReference','showChapterTime','showBookTime']
const string=(value,max=200)=>typeof value==='string'?value.slice(0,max):''
const stamp=value=>Number.isSafeInteger(value)&&value>=0&&value<=Date.now()+86400000?value:0
const idPattern=/^[a-f\d]{64}$/i
function note(value){
 if(!value||typeof value!=='object'||!string(value.id)||!['note','highlight','bookmark'].includes(value.kind)||!string(value.cfi,2000).startsWith('epubcfi('))return null
 return {id:string(value.id),kind:value.kind,cfi:string(value.cfi,2000),quote:string(value.quote,10000),text:string(value.text,10000),label:string(value.label),reference:string(value.reference,500),color:Object.hasOwn(annotationColors,value.color)?value.color:'gold',style:value.style==='highlight'?'highlight':'underline',fraction:Number.isFinite(value.fraction)?Math.max(0,Math.min(1,value.fraction)):0,createdAt:stamp(value.createdAt),updatedAt:stamp(value.updatedAt??value.createdAt)}
}
export function portablePreferences(input={}){
 const result={}
 for(const key of preferenceKeys){const value=input[key];if(['string','number','boolean'].includes(typeof value))result[key]=typeof value==='string'?value.slice(0,100):value}
 if(Array.isArray(input.customThemes))result.customThemes=input.customThemes.slice(0,30).flatMap(theme=>theme&&/^personal-[a-z\d-]+$/.test(theme.id)&&string(theme.label,48)&&Array.isArray(theme.colors)&&theme.colors.length===8&&theme.colors.every(color=>/^#[a-f\d]{6}$/i.test(color))?[{id:theme.id.slice(0,100),label:string(theme.label,48),icon:'palette',dark:theme.dark===true,colors:theme.colors}]:[])
 if(isPersonalScene(result.bookScene))result.bookScene='auto'
 return result
}
export function safeSync(input){
 if(!input||input.format!=='lector-sync'||input.version!==1||!Array.isArray(input.books)||input.books.length>10000)throw new Error('Los datos de sincronización no son válidos.')
 const books=input.books.flatMap(book=>{
  if(!book||!idPattern.test(book.id))return []
  const position=book.position,valid=position&&string(position.cfi,2000).startsWith('epubcfi(')
  const tombstones=Array.isArray(book.deletedNotes)?book.deletedNotes.slice(0,20000).filter(item=>item&&string(item.id)&&stamp(item.updatedAt)).map(item=>({id:string(item.id),updatedAt:stamp(item.updatedAt)})):[]
  return [{id:book.id.toLowerCase(),title:string(book.title),author:string(book.author),notes:(Array.isArray(book.notes)?book.notes:[]).slice(0,20000).map(note).filter(Boolean),deletedNotes:tombstones,position:valid?{cfi:string(position.cfi,2000),fraction:Number.isFinite(position.fraction)?Math.max(0,Math.min(1,position.fraction)):0,updatedAt:stamp(position.updatedAt)}:null}]
 })
 return {format:'lector-sync',version:1,books,preferences:portablePreferences(input.preferences??{})}
}
export function snapshot(records,settings,options){
 return safeSync({format:'lector-sync',version:1,books:options.notes||options.positions?records.map(book=>({id:book.id,title:book.title,author:book.author,notes:options.notes?book.notes:[],deletedNotes:options.notes?book.deletedNotes:[],position:options.positions?{cfi:book.anchorCFI??book.cfi,fraction:book.fraction,updatedAt:book.positionUpdatedAt??book.lastReadAt??0}:null})):[],preferences:options.preferences?settings:{}})
}
export function mergeNotes(a=[],b=[],deletions=[]){
 const removed=new Map();for(const item of deletions)removed.set(item.id,Math.max(removed.get(item.id)??0,item.updatedAt))
 const values=new Map();for(const item of [...a,...b]){const current=values.get(item.id);if(!current||item.updatedAt>current.updatedAt||item.updatedAt===current.updatedAt&&JSON.stringify(item)>JSON.stringify(current))values.set(item.id,item)}
 return [...values.values()].filter(item=>(removed.get(item.id)??-1)<item.updatedAt)
}
export function mergeSnapshots(a,b,choices={}){
 a=safeSync(a);b=safeSync(b);const map=new Map(a.books.map(book=>[book.id,book]))
 for(const remote of b.books){const local=map.get(remote.id);if(!local){map.set(remote.id,remote);continue}
  const deleted=new Map();for(const item of [...local.deletedNotes,...remote.deletedNotes])if((deleted.get(item.id)?.updatedAt??-1)<item.updatedAt)deleted.set(item.id,item)
  const deletedNotes=[...deleted.values()],remotePosition=choices[remote.id]==='remote',position=remotePosition?remote.position:choices[remote.id]==='local'?local.position:(!local.position||remote.position?.updatedAt>local.position.updatedAt)?remote.position:local.position
  map.set(remote.id,{...local,title:local.title||remote.title,author:local.author||remote.author,position,notes:mergeNotes(local.notes,remote.notes,deletedNotes),deletedNotes})
 }
 return safeSync({format:'lector-sync',version:1,books:[...map.values()],preferences:{...b.preferences,...a.preferences}})
}
export function positionConflicts(local,remote){
 const map=new Map(remote.books.map(book=>[book.id,book]))
 return local.books.flatMap(book=>{const other=map.get(book.id);return book.position&&other?.position&&book.position.cfi!==other.position.cfi?[{id:book.id,title:book.title,local:book.position,remote:other.position}]:[]})
}
export function applyPortable(book,data,options){
 const result={...book}
 if(options.notes){const removed=new Map();for(const item of [...(book.deletedNotes??[]),...data.deletedNotes])if((removed.get(item.id)?.updatedAt??-1)<item.updatedAt)removed.set(item.id,item);result.deletedNotes=[...removed.values()];result.notes=mergeNotes(book.notes??[],data.notes,result.deletedNotes)}
 if(options.positions&&data.position){result.cfi=data.position.cfi;result.anchorCFI=data.position.cfi;result.fraction=data.position.fraction;result.positionUpdatedAt=data.position.updatedAt;result.coverSeen=true;result.navigationTrail=undefined}
 return result
}
