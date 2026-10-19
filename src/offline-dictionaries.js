import {allDictionaryPacks,saveDictionaryPack,getDictionaryChunk,saveDictionaryChunk,removeDictionaryPack} from './storage.js'
import {normalizeTerm,dictionaryBucket,validateDictionaryEntries,validateGrammarEntries,dictionaryLanguages} from './dictionary-core.js'
import {lookup,legacyDefinition} from './dictionary.js'
const cache=new Map(),limit=32*1024*1024
const check=signal=>{if(signal?.aborted)throw new DOMException('Cancelled','AbortError')}
const hex=bytes=>[...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('')
export function validatePack(pack){
  if(pack.schema!==1||!dictionaryLanguages.includes(pack.language)||!dictionaryLanguages.includes(pack.definitionLanguage)||!pack.id||!/^[\w-]{1,120}$/.test(pack.id)||!Number.isInteger(pack.entries)||pack.entries<1||!Number.isInteger(pack.buckets)||pack.buckets<1||pack.buckets>256||!Array.isArray(pack.parts)||pack.parts.length!==pack.buckets||!pack.license)throw Error('El paquete de diccionario no es válido.')
  const seen=new Set()
  for(const part of pack.parts){if(!Number.isInteger(part.bucket)||part.bucket<0||part.bucket>=pack.buckets||seen.has(part.bucket)||!part.url||!Number.isInteger(part.bytes)||part.bytes<1||part.bytes>8*1024*1024||!Number.isInteger(part.rawBytes)||part.rawBytes>limit||!/^[a-f\d]{64}$/.test(part.sha256)||!/^[a-f\d]{64}$/.test(part.rawSha256))throw Error('El paquete de diccionario no es válido.');seen.add(part.bucket)}
  if(pack.parts.reduce((sum,part)=>sum+part.entries,0)!==pack.entries||pack.parts.reduce((sum,part)=>sum+part.bytes,0)!==pack.bytes)throw Error('El paquete de diccionario no es válido.')
  if(pack.grammar){const g=pack.grammar;if(g.schema!==1||!Array.isArray(g.parts)||g.parts.length!==pack.buckets||g.entries>pack.entries||g.parts.reduce((n,p)=>n+p.entries,0)!==g.entries||g.parts.reduce((n,p)=>n+p.bytes,0)!==g.bytes)throw Error('El paquete de diccionario no es válido.');for(const [index,part] of g.parts.entries())if(part.bucket!==index||!part.url||!Number.isInteger(part.entries)||part.entries<0||!Number.isInteger(part.bytes)||part.bytes<1||part.bytes>8*1024*1024||!Number.isInteger(part.rawBytes)||part.rawBytes>limit||!/^[a-f\d]{64}$/.test(part.sha256)||!/^[a-f\d]{64}$/.test(part.rawSha256))throw Error('El paquete de diccionario no es válido.')}
  return pack
}
export async function verifiedDictionaryPart(part,signal){
  check(signal)
  const response=await fetch(part.url,{signal,redirect:'error'});if(!response.ok)throw Error('No se pudo cargar el paquete de diccionario.')
  const decoded=response.headers.get('Content-Encoding')?.includes('gzip'),expectedBytes=decoded?part.rawBytes:part.bytes,expectedHash=decoded?part.rawSha256:part.sha256
  const reader=response.body.getReader(),chunks=[];let bytes=0
  try{while(true){check(signal);const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>expectedBytes||bytes>limit)throw Error('El paquete de diccionario no es válido.');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
  const blob=new Blob(chunks);if(bytes!==expectedBytes||hex(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))!==expectedHash)throw Error('La verificación del diccionario ha fallado.')
  const rows=await readDictionaryBlock(blob,decoded?'json':'gzip',signal),stored=decoded?await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob():blob
  return {rows,blob:stored}
}
export async function readDictionaryBlock(blob,encoding='gzip',signal){
  check(signal)
  const stream=encoding==='gzip'?blob.stream().pipeThrough(new DecompressionStream('gzip')):blob.stream()
  const reader=stream.getReader(),chunks=[];let bytes=0
  try{while(true){check(signal);const result=await reader.read();if(result.done)break;bytes+=result.value.length;if(bytes>limit)throw Error('El bloque del diccionario es demasiado grande.');chunks.push(result.value)}}finally{await reader.cancel().catch(()=>{})}
  return JSON.parse(await new Blob(chunks).text())
}
export async function installDictionary(pack,options={}){
  return navigator.locks?.request?navigator.locks.request('lector-dictionaries',{signal:options.signal},()=>installPack(pack,options)):installPack(pack,options)
}
async function installPack(pack,{signal,onProgress=()=>{}}={}){
  validatePack(pack)
  if((await allDictionaryPacks()).some(value=>value.id===pack.id&&value.installed))return pack
  const staging={...pack,installed:false,installedAt:Date.now()};await saveDictionaryPack(staging)
  let completed=0
  try{
    const parts=[...pack.parts.map(part=>({...part,kind:'definition'})),...(pack.grammar?.parts??[]).map(part=>({...part,kind:'grammar'}))],total=parts.length
    const space=await navigator.storage?.estimate?.();if(space?.quota&&space.quota-space.usage<parts.reduce((sum,part)=>sum+part.bytes,0))throw Error('No queda espacio para este diccionario.')
    for(const part of parts){
      check(signal);onProgress({completed,total,entries:pack.entries})
      const {rows,blob}=await verifiedDictionaryPart(part,signal),words=(part.kind==='grammar'?validateGrammarEntries:validateDictionaryEntries)(rows,pack.language)
      if(words.size!==part.entries||rows.length!==part.entries||[...words.keys()].some(word=>dictionaryBucket(word,pack.buckets)!==part.bucket))throw Error('El paquete de diccionario no es válido.')
      const bucket=part.kind==='grammar'?`grammar:${part.bucket}`:part.bucket
      check(signal);await saveDictionaryChunk({id:`${pack.id}:${bucket}`,packId:pack.id,bucket,encoding:'gzip',blob});completed++
    }
    check(signal);await saveDictionaryPack({...staging,installed:true});onProgress({completed,total,entries:pack.entries});return pack
  }catch(error){await removeDictionaryPack(pack.id);throw error}
}
export async function importOfflineDictionary(file,language='es',{signal,onProgress=()=>{}}={}){
  return navigator.locks?.request?navigator.locks.request('lector-dictionaries',{signal},()=>importPackFile(file,language,{signal,onProgress})):importPackFile(file,language,{signal,onProgress})
}
async function importPackFile(file,language,{signal,onProgress}){
  if(file.size>64*1024*1024)throw Error('El diccionario propio supera el límite de 64 MB.')
  check(signal);const input=JSON.parse(await file.text()),header=input&&typeof input.entries==='object'&&!Array.isArray(input.entries),data=header?input.entries:input
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('El diccionario propio no es válido.')
  language=header?input.language??language:language;if(!dictionaryLanguages.includes(language))throw Error('El idioma del diccionario no es válido.')
  const rows=Object.entries(data);if(!rows.length||rows.length>1000000)throw Error('El diccionario propio no es válido.')
  const words=new Map();for(let start=0;start<rows.length;start+=50000){check(signal);for(const [word,definition] of validateDictionaryEntries(rows.slice(start,start+50000),language))words.set(word,definition);await new Promise(resolve=>setTimeout(resolve,0))}
  const buckets=Array.from({length:64},()=>[]);for(const row of words)buckets[dictionaryBucket(row[0])].push(row)
  const fingerprint=hex(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())).slice(0,20),pack={id:`custom-${language}-${fingerprint}`,name:header&&typeof input.name==='string'?input.name.slice(0,160):file.name,language,definitionLanguage:header&&dictionaryLanguages.includes(input.definitionLanguage)?input.definitionLanguage:language,entries:words.size,buckets:64,bytes:file.size,custom:true,license:header&&typeof input.license==='string'?input.license.slice(0,100):'Personal',installedAt:Date.now(),installed:false}
  if((await allDictionaryPacks()).some(value=>value.id===pack.id&&value.installed))return pack
  try{await saveDictionaryPack(pack);for(let bucket=0;bucket<64;bucket++){check(signal);const blob=new Blob([JSON.stringify(buckets[bucket])]);if(blob.size>limit)throw Error('El bloque del diccionario es demasiado grande.');await saveDictionaryChunk({id:`${pack.id}:${bucket}`,packId:pack.id,bucket,encoding:'json',blob});onProgress({completed:bucket+1,total:64,entries:words.size})}check(signal);await saveDictionaryPack({...pack,installed:true});return pack}
  catch(error){await removeDictionaryPack(pack.id);throw error}
}
export function clearDictionaryCache(){cache.clear();projectBlocks.clear()}
export async function uninstallDictionary(id){
  const remove=async()=>{await removeDictionaryPack(id);clearDictionaryCache()}
  return navigator.locks?.request?navigator.locks.request('lector-dictionaries',remove):remove()
}
export async function lookupOffline(word,language='es',{project=false}={}){
  language=String(language).toLowerCase().split(/[-_]/)[0]
  const key=normalizeTerm(word,language),packs=(await allDictionaryPacks()).filter(pack=>pack.installed&&pack.language===language).sort((a,b)=>Number(Boolean(b.custom))-Number(Boolean(a.custom))||b.installedAt-a.installedAt)
  if(!key||!dictionaryLanguages.includes(language))return null
  const legacy=language==='es'?legacyDefinition(word):null;if(legacy)return {word:key,definition:legacy,basic:true}
  for(const pack of packs){
    const bucket=dictionaryBucket(key,pack.buckets),cacheKey=`${pack.id}:${bucket}`
    let words=cache.get(cacheKey)
    if(!words){const chunk=await getDictionaryChunk(pack.id,bucket);if(!chunk)continue;words=validateDictionaryEntries(await readDictionaryBlock(chunk.blob,chunk.encoding),language);cache.set(cacheKey,words);if(cache.size>4)cache.delete(cache.keys().next().value)}
    const definition=words.get(key);if(definition){let partsOfSpeech=[];if(pack.grammar){const grammarKey=`${pack.id}:grammar:${bucket}`;let grammar=cache.get(grammarKey);if(!grammar){const chunk=await getDictionaryChunk(pack.id,`grammar:${bucket}`);if(chunk){grammar=validateGrammarEntries(await readDictionaryBlock(chunk.blob,chunk.encoding),language);cache.set(grammarKey,grammar);if(cache.size>4)cache.delete(cache.keys().next().value)}}partsOfSpeech=grammar?.get(key)??[]}return {word:key,definition,partsOfSpeech,pack,sourceURL:pack.entryBase?`${pack.entryBase}${encodeURIComponent(key)}`:''}}
  }
  const basic=language==='es'?lookup(word):null
  if(project){try{const result=await lookupProject(key,language);if(result)return result}catch(error){if(!basic)throw error}}
  if(basic)return {word:key,definition:basic,basic:true}
  return null
}

const projectBlocks=new Map(),pendingBlocks=new Map()
async function projectBlock(pack,part,grammar=false){
  const key=part.url;if(projectBlocks.has(key))return projectBlocks.get(key)
  if(!pendingBlocks.has(key))pendingBlocks.set(key,(async()=>{
    // Only assets belonging to this application; never transmit the queried word.
    const url=new URL(part.url,location.href);if(url.origin!==location.origin)throw Error('No se pudo cargar el paquete de diccionario.')
    const {rows}=await verifiedDictionaryPart(part),words=(grammar?validateGrammarEntries:validateDictionaryEntries)(rows,pack.language)
    if(words.size!==part.entries||rows.length!==part.entries||[...words.keys()].some(word=>dictionaryBucket(word,pack.buckets)!==part.bucket))throw Error('El paquete de diccionario no es válido.')
    projectBlocks.set(key,words);if(projectBlocks.size>8)projectBlocks.delete(projectBlocks.keys().next().value);return words
  })().finally(()=>pendingBlocks.delete(key)))
  return pendingBlocks.get(key)
}
async function lookupProject(key,language){
  const {projectDictionaries}=await import('./dictionary-resources.js'),pack=projectDictionaries.find(pack=>pack.language===language)
  if(!pack)return null;validatePack(pack)
  const bucket=dictionaryBucket(key,pack.buckets),words=await projectBlock(pack,pack.parts.find(part=>part.bucket===bucket)),definition=words.get(key)
  if(!definition)return null
  let partsOfSpeech=[]
  if(pack.grammar){try{partsOfSpeech=(await projectBlock(pack,pack.grammar.parts.find(part=>part.bucket===bucket),true)).get(key)??[]}catch{/* A missing grammar block must not discard a valid definition. */}}
  return {word:key,definition,partsOfSpeech,pack,project:true,sourceURL:pack.entryBase?`${pack.entryBase}${encodeURIComponent(key)}`:''}
}
