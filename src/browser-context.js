import {contextMessages} from './context-core.js'

// No session or model download is created by checking availability.
export function browserContextOptions(source='es',output='es') {
  const supported=new Set(['en','es','ja','de','fr'])
  const input=String(source).split(/[-_]/)[0],language=String(output).split(/[-_]/)[0]
  if(!supported.has(input)||!supported.has(language))return null
  return {expectedInputs:[{type:'text',languages:[...new Set(['en',input])]}],expectedOutputs:[{type:'text',languages:[language]}]}
}
export async function browserContextAvailability(source,output,api=globalThis.LanguageModel) {
  const options=browserContextOptions(source,output)
  if(!options||!api?.availability||!api?.create)return 'unavailable'
  try{return await api.availability(options)}catch{return 'unavailable'}
}
export async function requestBrowserContext(input,{api=globalThis.LanguageModel,onProgress=()=>{}}={}) {
  const messages=contextMessages(input),options=browserContextOptions(input.sourceLanguage,input.language)
  if(!options||!api?.create)throw new Error('La IA del navegador no está disponible para este equipo o idioma.')
  let session
  try {
    session=await api.create({...options,signal:input.signal,initialPrompts:[messages[0]],monitor(monitor){monitor.addEventListener('downloadprogress',event=>onProgress(Math.max(0,Math.min(100,Math.round(event.loaded*100)))))}})
    input.signal?.throwIfAborted()
    const result=await session.prompt([messages[1]],{signal:input.signal})
    input.signal?.throwIfAborted()
    if(typeof result!=='string'||!result.trim())throw new Error('El servicio no devolvió una respuesta compatible.')
    if(result.length>20000)throw new Error('La respuesta del servicio es demasiado grande.')
    return result.trim()
  } finally {session?.destroy()}
}
