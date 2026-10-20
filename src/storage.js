import {isPersonalScene} from './personal-scene-core.js'
import {batchPaths,batchValue,sameBatchValue,patchBatchRecord} from './catalog-batch-core.js'
import {narrationProfiles} from './narration.js'
import {reviveNativeHandles} from './native-directory.js'
import { fonts, themes, validateTheme } from './presentation.js'
const DB_NAME = 'lector-zen'
let connection

async function db() {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 10)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('books')) request.result.createObjectStore('books', { keyPath: 'id' })
      if (!request.result.objectStoreNames.contains('folders')) request.result.createObjectStore('folders', { keyPath: 'id' })
      if (!request.result.objectStoreNames.contains('scenes')) request.result.createObjectStore('scenes', { keyPath: 'id' })
      if (!request.result.objectStoreNames.contains('fonts')) request.result.createObjectStore('fonts', { keyPath: 'id' })
      if (!request.result.objectStoreNames.contains('catalog')) request.result.createObjectStore('catalog', { keyPath:'id' })
      if (!request.result.objectStoreNames.contains('catalogBatches')) request.result.createObjectStore('catalogBatches', {keyPath:'id'})
      if (!request.result.objectStoreNames.contains('collections')) request.result.createObjectStore('collections', { keyPath:'id' })
      if (!request.result.objectStoreNames.contains('dictionaryPacks')) request.result.createObjectStore('dictionaryPacks', {keyPath:'id'})
      if (!request.result.objectStoreNames.contains('dictionaryChunks')){const chunks=request.result.createObjectStore('dictionaryChunks',{keyPath:'id'});chunks.createIndex('packId','packId')}
      if (!request.result.objectStoreNames.contains('vocabulary')) request.result.createObjectStore('vocabulary',{keyPath:'id'})
      if (!request.result.objectStoreNames.contains('translations')) request.result.createObjectStore('translations',{keyPath:'id'})
      if (!request.result.objectStoreNames.contains('audioChapters')) request.result.createObjectStore('audioChapters',{keyPath:'id'})
      if (!request.result.objectStoreNames.contains('syncData')) request.result.createObjectStore('syncData',{keyPath:'id'})
    }
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); connection = undefined }
      resolve(request.result)
    }
    request.onblocked = () => { connection = undefined; reject(new Error('Cierra otras pestañas del lector y vuelve a abrirlo para actualizar la biblioteca.')) }
    request.onerror = () => reject(request.error)
  })
  return connection
}

async function transact(mode, action, storeName = 'books') {
  const database = await db()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, mode)
    const request = action(tx.objectStore(storeName))
    tx.oncomplete = () => resolve(reviveNativeHandles(request.result))
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export const getBook = id => transact('readonly', store => store.get(id))
export const saveBook = book => transact('readwrite', store => store.put(book))
export const removeBook = async id => {await transact('readwrite', store => store.delete(id));await removeTranslation(id);for(const audio of await allAudioChapters())if(audio.bookId===id)await removeAudioChapter(audio.id)}
export const allAudioChapters=()=>transact('readonly',store=>store.getAll(),'audioChapters')
export const saveAudioChapter=value=>transact('readwrite',store=>store.put(value),'audioChapters')
export const removeAudioChapter=id=>transact('readwrite',store=>store.delete(id),'audioChapters')
export const getSyncData=id=>transact('readonly',store=>store.get(id),'syncData')
export const saveSyncData=value=>transact('readwrite',store=>store.put(value),'syncData')
export const getTranslation = id => transact('readonly',store=>store.get(id),'translations')
export const saveTranslation = value => transact('readwrite',store=>store.put(value),'translations')
export const removeTranslation = id => transact('readwrite',store=>store.delete(id),'translations')
export const allBooks = async () => (await transact('readonly', store => store.getAll()))
  .sort((a, b) => b.updatedAt - a.updatedAt)
export const allFolders = () => transact('readonly', store => store.getAll(), 'folders')
export const saveFolder = folder => transact('readwrite', store => store.put(folder), 'folders')
export const removeFolder = id => transact('readwrite', store => store.delete(id), 'folders')
export const allScenes=()=>transact('readonly',store=>store.getAll(),'scenes')
export const saveScene=scene=>transact('readwrite',store=>store.put(scene),'scenes')
export const removeScene=id=>transact('readwrite',store=>store.delete(id),'scenes')
export const allFonts = () => transact('readonly',store=>store.getAll(),'fonts')
export const saveFont = font => transact('readwrite',store=>store.put(font),'fonts')
export const removeFont = id => transact('readwrite',store=>store.delete(id),'fonts')
export const allCatalog = () => transact('readonly',store=>store.getAll(),'catalog')
export const getCatalog = id => transact('readonly',store=>store.get(id),'catalog')
export const saveCatalog = record => transact('readwrite',store=>store.put(record),'catalog')
export async function updateCatalog(id,change){
  const database=await db()
  return new Promise((resolve,reject)=>{const tx=database.transaction('catalog','readwrite'),store=tx.objectStore('catalog'),request=store.get(id);let result
    request.onsuccess=()=>{try{result={...change(request.result??{id}),id};store.put(result)}catch(error){reject(error);tx.abort()}}
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)
  })
}
export const removeCatalog = id => transact('readwrite',store=>store.delete(id),'catalog')
export const getCatalogBatch=()=>transact('readonly',store=>store.get('last'),'catalogBatches')
// All selected changes and their undo journal commit together. A conflict or a
// storage error aborts the whole transaction, including replacement of the journal.
export async function commitCatalogBatch(plan,{undo=false}={}){
  const database=await db()
  return new Promise((resolve,reject)=>{
    const tx=database.transaction(['catalog','catalogBatches','collections'],'readwrite'),catalog=tx.objectStore('catalog'),history=tx.objectStore('catalogBatches')
    let failure,count=0
    const fail=error=>{failure=error;try{tx.abort()}catch{/* Already aborted. */}}
    const run=(batch,collectionIDs)=>{
      const entries=batch?.entries
      if(!Array.isArray(entries)||!entries.length||entries.length>10000||new Set(entries.map(entry=>entry.id)).size!==entries.length){fail(Error('No hay cambios que aplicar.'));return}
      if(entries.some(entry=>typeof entry.id!=='string'||!Array.isArray(entry.fields)||!entry.fields.length||entry.fields.some(field=>!batchPaths.includes(field.path)))){fail(Error('Los cambios del lote no son válidos.'));return}
      const ids=[...new Set([...entries.map(entry=>entry.id),...(undo?[]:(batch.guards??[]).map(guard=>guard.id))])],records=new Map();let remaining=ids.length
      for(const id of ids){const request=catalog.get(id);request.onsuccess=()=>{records.set(id,request.result);if(--remaining)return
        try{
          if(!undo&&(!Array.isArray(batch.guards)||batch.guards.some(guard=>!sameBatchValue(records.get(guard.id)??null,guard.before))))throw Error('El catálogo ha cambiado. Revisa de nuevo los cambios antes de continuar.')
          for(const entry of entries)for(const field of entry.fields){
            if(!sameBatchValue(batchValue(records.get(entry.id),field.path),field[undo?'after':'before']))throw Error(undo?'Estos datos han cambiado después del lote. No se ha deshecho ningún cambio.':'El catálogo ha cambiado. Revisa de nuevo los cambios antes de continuar.')
            const value=field[undo?'before':'after'];if(field.path==='collections'&&value.exists&&value.value.some(id=>!collectionIDs.includes(id)))throw Error('Una colección ya no existe. Revisa la selección.')
          }
          for(const entry of entries){const next=patchBatchRecord(records.get(entry.id),entry.fields,undo?'before':'after');next.id=entry.id;next.updatedAt=Date.now();catalog.put(next)}
          if(undo)history.delete('last');else history.put({id:'last',token:crypto.randomUUID(),version:1,createdAt:Date.now(),entries:entries.map(({id,title,fields})=>({id,title,fields}))})
          count=entries.length
        }catch(error){fail(error)}
      }}
    }
    const collections=tx.objectStore('collections').getAllKeys();collections.onsuccess=()=>{if(undo){const request=history.get('last');request.onsuccess=()=>{if(!plan?.token||request.result?.token!==plan.token){fail(Error('El catálogo ha cambiado. Revisa de nuevo los cambios antes de continuar.'));return}run(request.result,collections.result)}}else run(plan,collections.result)}
    tx.oncomplete=()=>resolve(count);tx.onerror=()=>reject(failure??tx.error);tx.onabort=()=>reject(failure??tx.error??Error('No se pudo guardar el lote.'))
  })
}
export const allCollections = () => transact('readonly',store=>store.getAll(),'collections')
export const allDictionaryPacks=()=>transact('readonly',store=>store.getAll(),'dictionaryPacks')
export const saveDictionaryPack=pack=>transact('readwrite',store=>store.put(pack),'dictionaryPacks')
export const getDictionaryChunk=(id,bucket)=>transact('readonly',store=>store.get(`${id}:${bucket}`),'dictionaryChunks')
export const saveDictionaryChunk=chunk=>transact('readwrite',store=>store.put(chunk),'dictionaryChunks')
export const allVocabulary=()=>transact('readonly',store=>store.getAll(),'vocabulary')
export const saveVocabulary=word=>transact('readwrite',store=>store.put(word),'vocabulary')
export const removeVocabulary=id=>transact('readwrite',store=>store.delete(id),'vocabulary')
export async function removeDictionaryPack(id){
  const database=await db()
  return new Promise((resolve,reject)=>{
    const tx=database.transaction(['dictionaryPacks','dictionaryChunks'],'readwrite');tx.objectStore('dictionaryPacks').delete(id)
    const store=tx.objectStore('dictionaryChunks'),cursor=store.index('packId').openKeyCursor(IDBKeyRange.only(id))
    cursor.onsuccess=()=>{const row=cursor.result;if(row){store.delete(row.primaryKey);row.continue()}}
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)
  })
}
export const saveCollection = collection => transact('readwrite',store=>store.put(collection),'collections')
export async function removeCollection(id){
  const database=await db()
  return new Promise((resolve,reject)=>{
    const tx=database.transaction(['collections','catalog'],'readwrite');tx.objectStore('collections').delete(id)
    const cursor=tx.objectStore('catalog').openCursor()
    cursor.onsuccess=()=>{const item=cursor.result;if(!item)return;if(item.value.collections?.includes(id))item.update({...item.value,collections:item.value.collections.filter(value=>value!==id)});item.continue()}
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)
  })
}

export async function fileId(file) {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback }
  catch { return fallback }
}

export function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true }
  catch { return false }
}

export const defaults = Object.freeze({
  theme: 'auto', font: 'Georgia', fontSize: 21, lineHeight: 1.75,
  paragraphGap: 0.8, columns: 2, width: 1320, gutter: 7,
  justify: false, animated: true, highlight: true, provider: 'browser', uiLanguage: 'auto',
  paperLightEnabled:false,paperBrightness:100,paperWarmth:0,paperInverted:false,paperCustomColors:false,paperBackground:'#f7efdc',paperInk:'#30291f',
  appearance: 'minimal', bookScene:'auto', bookMobileView:'page', bookBinding:'hardcover', bookCameraZoom:100,bookCameraX:0,bookCameraY:0,bookCornerDrag:true, coverSize:165, libraryView: 'list', fullWidth: false,
  followSpeech: true, clickToRead: true, highlightMode: 'word',
  marginOuter: 10, marginInner: 28, hyphenate: false, customThemes: [],
  showOpeningCover: true,
  libraryDialogView: 'covers',
  readingFlow:'paginated',tvMode:false,tvScale:1.35,historyControls:true,
  showReference:false,showChapterTime:false,showBookTime:false,estimateMode:'reading',visualWpm:220,narrationWpm:170,
  libraryDetails:false,
  preloadCovers:true,preloadEmbeddedCovers:true,
  showAnnotations:true,
  dictionaryLanguage:'auto',
  voice: '', rate: 1, pitch: 1, language: 'es-ES', speechLanguage: 'auto',
  endpoint: 'https://api.openai.com/v1/audio/speech',
  localEndpoint:'http://127.0.0.1:5055',localVoice:'es_ES-sharvard-medium',localSpeaker:0,localNoise:.667,localWidth:.8,
  elevenEndpoint:'https://api.elevenlabs.io/v1/text-to-speech',elevenModel:'eleven_multilingual_v2',elevenVoice:'',elevenStability:.5,
  model: 'gpt-4o-mini-tts', apiVoice: 'coral',
  instructions: 'Narra el texto íntegro en español de España, con entonación natural y expresiva. Respeta las pausas y no añadas ni omitas palabras.',
  narrationEnabled:false,narrationProfile:'neutral',narrationPrompt:'',
  sleepEnabled:false,sleepMinutes:30,rewindMode:'sentence',rewindSeconds:10,
  pronunciationsEnabled:false,pronunciations:[],
  voicePrice:0,voicePriceUnit:'characters',voiceCurrency:'EUR',costMargin:1.25,
  costLimitEnabled:false,costLimit:5,characterLimitEnabled:false,characterLimit:100000,
  audioResponseLimitMB:16,audioExportLimitMB:128,
})

export function effectiveTheme(theme, hour = new Date().getHours()) {
  if (theme !== 'auto') return theme
  return hour >= 7 && hour < 18 ? 'morning' : hour >= 18 && hour < 22 ? 'afternoon' : 'night'
}

export function safeSettings(input = {}) {
  const value = { ...defaults, ...input }
  const clamp = (key, min, max) => {
    const number = Number(value[key])
    value[key] = Math.min(max, Math.max(min, Number.isFinite(number) ? number : defaults[key]))
  }
  if(!narrationProfiles.some(item=>item.id===value.narrationProfile))value.narrationProfile='neutral'
  value.narrationPrompt=String(value.narrationPrompt??'').slice(0,1000)
  clamp('localSpeaker',0,999);value.localSpeaker=Math.round(value.localSpeaker);clamp('localNoise',0,2);clamp('localWidth',0,2);clamp('elevenStability',0,1)
  clamp('fontSize', 14, 36); clamp('lineHeight', 1.2, 2.4)
  clamp('paragraphGap', 0, 2); clamp('columns', 1, 3); value.columns = Math.round(value.columns)
  clamp('width', 640, 3840); clamp('gutter', 1, 12)
  clamp('paperBrightness',60,140);clamp('paperWarmth',-100,100)
  for(const key of ['paperLightEnabled','paperInverted','paperCustomColors'])if(typeof value[key]!=='boolean')value[key]=defaults[key]
  for(const key of ['paperBackground','paperInk'])if(typeof value[key]!=='string'||!/^#[a-f\d]{6}$/i.test(value[key]))value[key]=defaults[key]
  clamp('coverSize',100,280)
  clamp('bookCameraZoom',100,200);clamp('bookCameraX',-100,100);clamp('bookCameraY',-100,100)
  if(typeof value.bookCornerDrag!=='boolean')value.bookCornerDrag=defaults.bookCornerDrag
  if(!['page','spread'].includes(value.bookMobileView))value.bookMobileView='page'
  if(!['hardcover','paperback','notebook'].includes(value.bookBinding))value.bookBinding='hardcover'
  if(!['minimal','book'].includes(value.appearance))value.appearance='minimal'
  if(!isPersonalScene(value.bookScene)&&!['auto','home','afternoon','night','cabin','school','office','library','bamboo','garden','study','olive'].includes(value.bookScene))value.bookScene='auto'
  clamp('rate', 0.5, 2); clamp('pitch', 0.5, 1.5)
  clamp('marginOuter',0,160); clamp('marginInner',0,100)
  clamp('tvScale',1,2);clamp('visualWpm',80,600);clamp('narrationWpm',80,300)
  clamp('sleepMinutes',1,240);clamp('rewindSeconds',3,120);clamp('voicePrice',0,1000);clamp('costMargin',1,3);clamp('costLimit',.01,10000);clamp('characterLimit',1,100000000);clamp('audioResponseLimitMB',1,64);clamp('audioExportLimitMB',8,512)
  if(!['sentence','seconds'].includes(value.rewindMode))value.rewindMode='sentence'
  if(!['characters','minutes'].includes(value.voicePriceUnit))value.voicePriceUnit='characters'
  if(!['EUR','USD','GBP'].includes(value.voiceCurrency))value.voiceCurrency='EUR'
  value.pronunciations=(Array.isArray(value.pronunciations)?value.pronunciations:[]).slice(0,100).filter(rule=>typeof rule?.from==='string'&&rule.from.trim()&&typeof rule?.to==='string'&&rule.to.trim()).map(rule=>({from:rule.from.slice(0,100),to:rule.to.slice(0,200),whole:rule.whole!==false}))
  if(!['paginated','scrolled'].includes(value.readingFlow))value.readingFlow='paginated'
  if(!['reading','audio'].includes(value.estimateMode))value.estimateMode='reading'
  value.customThemes=(Array.isArray(value.customThemes)?value.customThemes:[]).slice(0,30).flatMap(theme=>{try{return [validateTheme(theme,true)]}catch{return []}})
  if (![...themes,...value.customThemes].some(theme => theme.id === value.theme)) value.theme = 'auto'
  if (!fonts.some(([name]) => name === value.font)) value.font = 'Georgia'
  if (!['auto','es','ca','en','fr','de','pt','it','zh','ja','hi'].includes(value.uiLanguage)) value.uiLanguage = 'auto'
  if (!['auto','es','ca','en','fr','de','pt','it','zh','ja','hi'].includes(value.speechLanguage)) value.speechLanguage = 'auto'
  if (!['auto','es','ca','en','fr','de','pt','it','zh','ja','hi'].includes(value.dictionaryLanguage)) value.dictionaryLanguage='auto'
  if (!['list','covers'].includes(value.libraryView)) value.libraryView = 'list'
  if (!['list','covers'].includes(value.libraryDialogView)) value.libraryDialogView = 'covers'
  if (!['browser', 'openai','piper','elevenlabs'].includes(value.provider)) value.provider = 'browser'
  if (!['word','sentence'].includes(value.highlightMode)) value.highlightMode = 'word'
  return value
}
