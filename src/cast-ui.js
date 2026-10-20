import config from '../config/cast.json'
import {registerPlugin} from '@capacitor/core'
import {icon} from './icons.js'
import {t,currentLanguage} from './i18n.js'
import {validAppId} from './cast-protocol.js'
import {CastAudio} from './cast-output.js'
import {createWebCast,createAndroidCast} from './cast-sender.js'
export function addCastMenu(){
  const section=document.createElement('details');section.id='cast-settings';section.className='settings-section'
  section.innerHTML='<summary>Emisión de audio</summary><p id="cast-status" class="small muted" role="status"></p><p class="small muted">Compatible con audio de Piper o de una API. Las voces del navegador no se pueden transmitir.</p><p class="small muted">El emisor debe permanecer abierto para generar los siguientes fragmentos. Los libros no se suben a un servidor.</p><button id="cast-settings-connect" class="text-button" hidden>Enviar audio</button>'
  document.querySelector('#preferences-panel').append(section)
}
export function createCastTools({platform,getSettings,getRecord,getSpeech,toast,onError,appId=config.receiverApplicationId}){
  const button=document.createElement('button');button.id='cast-toggle';button.className='icon-button';button.innerHTML=icon('cast');button.hidden=true;document.querySelector('.toolbar-reading').append(button)
  const status=document.getElementById('cast-status'),link=document.getElementById('cast-settings-connect');let route,coverRecord,cover='',wasConnected=false
  function refresh(){
    const active=route?.active,label=active?'Dejar de emitir':'Enviar audio';button.hidden=link.hidden=!route?.available
    button.title=t(label);button.setAttribute('aria-label',t(label));button.setAttribute('aria-pressed',String(Boolean(active)));link.textContent=t(label)
    status.textContent=active?`${t('Conectado a')}: ${route.device}`:!validAppId(appId)?t('Google Cast pendiente de activación del proyecto.'):route?.available?t('Elige un dispositivo Google Cast.'):t('Google Cast no está disponible en este dispositivo.')
  }
  async function request(){
    try{if(route.active){await route.disconnect();refresh();return}if(getSettings().provider==='browser'){toast('Elige Piper o una API en Ajustes de voz para emitir audio.');return}
      await route.request()
    }catch(error){if(!['cancel','cancelled','canceled'].includes(error?.code??error))onError(Error(t('No se pudo conectar con el dispositivo.')))}
  }
  button.onclick=link.onclick=request
  function changed(){refresh();if(route?.active){wasConnected=true;toast('Conectado. La lectura se enviará desde el siguiente fragmento.')}else if(wasConnected){wasConnected=false;getSpeech()?.stop()}}
  async function prepare(){refresh();if(!validAppId(appId))return
    const report=message=>onError(Error(t(message)))
    if(platform.android&&!platform.tv)route=await createAndroidCast({plugin:registerPlugin('LectorCast'),appId,onState:changed,onError:report})
    else if(!platform.native&&!platform.desktop&&/^https?:$/.test(location.protocol)&&!(/Android|iPhone|iPad/.test(navigator.userAgent))){route=createWebCast({appId,onState:changed,onError:report});try{await route.initialize()}catch{}}
    refresh()
  }
  async function metadata(segment){
    const record=getRecord()??{}
    if(coverRecord!==record.id){coverRecord=record.id;cover='';if(record.coverBlob){const url=URL.createObjectURL(record.coverBlob);try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas'),scale=Math.min(128/image.naturalWidth,192/image.naturalHeight);canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const result=canvas.toDataURL('image/jpeg',.65);if(result.length<=16000)cover=result}catch{}finally{URL.revokeObjectURL(url)}}}
    const speech=getSpeech(),index=speech?.view.resolveNavigation(segment.cfi)?.index,entries=[];const visit=items=>{for(const item of items??[]){const at=speech?.view.resolveNavigation(item.href)?.index;if(Number.isInteger(at)&&at<=index&&!entries.some(entry=>entry.at===at))entries.push({at,label:item.label});visit(item.subitems)}};visit(speech?.view.book?.toc);entries.sort((a,b)=>a.at-b.at)
    return {title:record.title,author:record.author,chapter:entries.at(-1)?.label??'',text:segment.text,language:currentLanguage(),cover}
  }
  queueMicrotask(()=>prepare().catch(()=>refresh()))
  return {refresh,get active(){return Boolean(route?.active)},validate(){if(route?.active&&getSettings().provider==='browser')throw Error(t('Elige Piper o una API en Ajustes de voz para emitir audio.'))},async audio(blob,segment){if(!route?.active)return null;const info=await metadata(segment);if(!route.active)throw Error(t('La emisión no pudo continuar.'));return new CastAudio(route,blob,info)}}
}
