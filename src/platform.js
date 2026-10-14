import {Capacitor,registerPlugin} from '@capacitor/core'
import {nativeSpeechAdapter} from './native-speech.js'
import {setDirectoryTransport,chooseNativeFolder,nativeFile} from './native-directory.js'
const Device=registerPlugin('LectorDevice'),Speech=registerPlugin('LectorSpeech')
export const platform={native:Capacitor.isNativePlatform(),desktop:Boolean(globalThis.lectorDesktop),tv:false,printing:true}
function bytes64(bytes){let text='';for(let offset=0;offset<bytes.length;offset+=16384)text+=String.fromCharCode(...bytes.subarray(offset,offset+16384));return btoa(text)}
export async function initializePlatform(){
  if(platform.desktop){setDirectoryTransport(globalThis.lectorDesktop);window.showDirectoryPicker=chooseNativeFolder;installSavePicker(globalThis.lectorDesktop);return}
  if(!platform.native)return
  const info=await Device.info();platform.tv=info.tv;platform.printing=info.printing
  document.documentElement.classList.add('native-app')
  const adapter=await nativeSpeechAdapter(Speech)
  Object.defineProperty(window,'speechSynthesis',{value:adapter.synthesis,configurable:true})
  Object.defineProperty(window,'SpeechSynthesisUtterance',{value:adapter.Utterance,configurable:true})
  setDirectoryTransport({chooseFolder:options=>Device.chooseFolder(options),permission:options=>Device.permission(options),listDirectory:options=>Device.listDirectory(options),releaseBook:options=>Device.releaseBook(options),readFile:async options=>{const result=await Device.readFile(options);return {...result,url:Capacitor.convertFileSrc(result.uri)}}})
  window.showDirectoryPicker=chooseNativeFolder
  installSavePicker(Device)
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)adapter.refresh()})
}
function installSavePicker(device){window.showSaveFilePicker=async options=>({createWritable:async()=>{let blob;return {write:async value=>{blob=value instanceof Blob?value:new Blob([value])},abort:async()=>{blob=null},close:async()=>{if(!blob)return;if(blob.size>100*1024*1024)throw Error('El archivo supera 100 MB.');const result=await device.saveFile({name:options.suggestedName??'Lector',type:blob.type||'application/octet-stream',base64:bytes64(new Uint8Array(await blob.arrayBuffer()))});blob=null;if(result?.cancelled)throw new DOMException('Cancelado','AbortError')}}}})}
export async function openPlatformBooks(open,onError){
  const receive=async data=>{if(!data)return;try{await open(await nativeFile(data))}catch(error){onError(error)}finally{if(data.token)Device.releaseBook({token:data.token}).catch(()=>{})}}
  if(platform.desktop){window.lectorDesktop.onOpenBook(receive);await receive(await window.lectorDesktop.initialBook())}
  if(platform.native){await Device.addListener('openBook',data=>receive({...data,url:Capacitor.convertFileSrc(data.uri)}));const data=await Device.initialBook();if(data?.uri)await receive({...data,url:Capacitor.convertFileSrc(data.uri)})}
  if(window.launchQueue)window.launchQueue.setConsumer(async launch=>{for(const handle of launch.files??[])try{await open(await handle.getFile())}catch(error){onError(error)}})
}
export async function printPlatformHTML(html){if(!platform.native)return false;await Device.printHTML({html});return true}
let metadataBook
export async function platformMetadata(record){
  if(!platform.native||!record||metadataBook===record.id)return
  metadataBook=record.id;let cover=''
  try{if(record.coverBlob){const image=await createImageBitmap(record.coverBlob),canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;canvas.getContext('2d').drawImage(image,0,0,256,256);image.close();cover=canvas.toDataURL('image/jpeg',.8).split(',')[1]}}catch{}
  await Speech.metadata({title:record.title??'',artist:record.author??'',cover}).catch(()=>{})
}
