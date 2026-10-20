import {normalize} from './library.js'
export const batchPaths=['overrides.author','overrides.tags','overrides.series','overrides.seriesIndex','collections']
export const sameBatchValue=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
export function batchValue(record,path){
  const keys=path.split('.');let value=record
  for(const key of keys){if(!value||!Object.hasOwn(value,key))return {exists:false};value=value[key]}
  return {exists:true,value:structuredClone(value)}
}
export function patchBatchRecord(record,fields,direction='after'){
  const result={...record,overrides:{...record?.overrides}}
  for(const field of fields){
    if(!batchPaths.includes(field.path))throw Error('Los cambios del lote no son válidos.')
    const [key,child]=field.path.split('.'),target=child?result.overrides:result,name=child??key,value=field[direction]
    if(value.exists)target[name]=structuredClone(value.value);else delete target[name]
  }
  if(!Object.keys(result.overrides).length)delete result.overrides
  return result
}
const unique=values=>{
  if(!Array.isArray(values)||values.some(value=>typeof value!=='string'||!value.trim()||value.length>160))throw Error('Los cambios del lote no son válidos.')
  const seen=new Set(),result=values.map(value=>value.trim()).filter(value=>{const key=normalize(value);if(seen.has(key))return false;seen.add(key);return true})
  if(result.length>100)throw Error('Un libro admite hasta 100 etiquetas o colecciones.')
  return result
}
function combine(before,change){
  if(!['add','remove','replace'].includes(change.mode))throw Error('Los cambios del lote no son válidos.')
  const values=unique(change.values)
  return unique(change.mode==='replace'?values:change.mode==='remove'?before.filter(value=>!values.some(other=>normalize(other)===normalize(value))):[...before,...values])
}
export const batchSignature=item=>JSON.stringify([item.author??'',item.tags??[],item.series??'',item.seriesIndex??null,item.collections??[]])
export function planCatalogBatch(items,records,config){
  if(!items.length||items.length>10000||new Set(items.map(item=>item.id)).size!==items.length)throw Error('Selecciona entre 1 y 10000 libros.')
  if(Object.hasOwn(config,'author')&&(typeof config.author!=='string'||config.author.length>400))throw Error('Los cambios del lote no son válidos.')
  if(config.series&&(typeof config.series.name!=='string'||config.series.name.length>160||config.series.number&&(!config.series.name.trim()||!Number.isFinite(config.series.start)||config.series.start<0||config.series.start+items.length>1000000)))throw Error('Los cambios del lote no son válidos.')
  const stored=new Map(records.map(record=>[record.id,record])),guards=new Map(),entries=[]
  for(const [index,item] of items.entries()){
    const before=stored.get(item.id),fields=[],display={author:item.author??'',tags:item.tags??[],series:item.series??'',seriesIndex:item.seriesIndex??null,collections:item.collections??[]}
    const add=(path,value,key)=>{if(!sameBatchValue(display[key],value)){fields.push({path,before:batchValue(before,path),after:{exists:true,value},from:structuredClone(display[key]),to:structuredClone(value)})}}
    if(Object.hasOwn(config,'author'))add('overrides.author',config.author.trim(),'author')
    if(config.tags)add('overrides.tags',combine(display.tags,config.tags),'tags')
    if(config.series){add('overrides.series',config.series.name.trim(),'series');if(!config.series.name.trim()||config.series.number)add('overrides.seriesIndex',config.series.name.trim()?config.series.start+index:null,'seriesIndex')}
    if(config.collections)add('collections',combine(display.collections,config.collections),'collections')
    if(fields.length){
      entries.push({id:item.id,title:item.title,signature:batchSignature(item),fields})
      for(const id of new Set([item.id,item.savedId].filter(Boolean)))guards.set(id,{id,before:stored.get(id)??null})
    }
  }
  return {version:1,entries,guards:[...guards.values()]}
}
