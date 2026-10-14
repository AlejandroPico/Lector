import {validateEndpoint} from './speech.js'

export function localEndpoint(value) {
  const url=new URL(validateEndpoint(value))
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('La voz local debe estar en localhost.')
  return url.href.replace(/\/$/,'')
}
export function voiceRequest(text,settings,key) {
  if(settings.provider==='piper')return {url:`${localEndpoint(settings.localEndpoint)}/synthesize`,headers:{'Content-Type':'application/json'},body:{text,voice:settings.localVoice,speaker_id:Number(settings.localSpeaker)||0,noise_scale:Number(settings.localNoise??.667),noise_w_scale:Number(settings.localWidth??.8),length_scale:1}}
  if(!key)throw new Error('Introduce tu clave en los ajustes de voz antes de usar el servicio externo.')
  if(settings.provider==='elevenlabs'){
    const voice=settings.elevenVoice.trim()
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(voice))throw new Error('Introduce el identificador de la voz de ElevenLabs.')
    return {url:`${validateEndpoint(settings.elevenEndpoint).replace(/\/$/,'')}/${encodeURIComponent(voice)}`,headers:{'Content-Type':'application/json','xi-api-key':key},body:{text,model_id:settings.elevenModel,voice_settings:{stability:settings.elevenStability,similarity_boost:.75}}}
  }
  return {url:validateEndpoint(settings.endpoint),headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:{model:settings.model,voice:settings.apiVoice,input:text,...(/^tts-1(?:-hd)?$/.test(settings.model)?{}:{instructions:settings.instructions}),response_format:'mp3'}}
}
export async function localVoices(endpoint,signal) {
  const response=await fetch(`${localEndpoint(endpoint)}/voices`,{signal,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'})
  if(!response.ok)throw new Error('No se pudo conectar con la voz local.')
  const data=await response.json()
  return Object.entries(data).slice(0,200).map(([id,config])=>({id,language:config.language?.code??config.espeak?.voice??'',speakers:Object.entries(config.speaker_id_map??{}).map(([name,id])=>({name,id})),count:config.num_speakers||1}))
}
