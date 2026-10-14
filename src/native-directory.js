let transport
export function setDirectoryTransport(value){transport=value}
function service(){if(!transport)throw new DOMException('Abre esta carpeta desde la aplicación donde la añadiste.','NotAllowedError');return transport}
async function nativeFile(data){
  if(data.bytes)return new File([data.bytes],data.name,{lastModified:data.lastModified??Date.now()})
  if(data.size>100*1024*1024)throw Error('El archivo supera 100 MB.')
  const response=await fetch(data.url)
  if(!response.ok)throw Error('No se pudo abrir el archivo.')
  const reader=response.body.getReader(),chunks=[];let size=0
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>100*1024*1024){await reader.cancel();throw Error('El archivo supera 100 MB.')}chunks.push(value)}
  return new File(chunks,data.name,{type:data.type??response.headers.get('Content-Type')??'',lastModified:data.lastModified??Date.now()})
}
export {nativeFile}
class NativeHandle {
  constructor(data){Object.assign(this,data);this.nativeLectorHandle=true}
  async queryPermission(){try{return (await service().permission({rootId:this.rootId})).state}catch{return 'denied'}}
  async requestPermission(){const result=await service().chooseFolder({rootId:this.rootId});if(!result||result.cancelled)throw new DOMException('Cancelado','AbortError');Object.assign(this,result);return 'granted'}
  async isSameEntry(other){return this.rootId===other?.rootId&&JSON.stringify(this.parts)===JSON.stringify(other.parts)}
  async getFile(){if(this.kind!=='file')throw new DOMException('No es un archivo','TypeMismatchError');const data=await service().readFile({rootId:this.rootId,parts:this.parts});try{return await nativeFile(data)}finally{if(data.token)await service().releaseBook?.({token:data.token})}}
  async *values(){if(this.kind!=='directory')throw new DOMException('No es una carpeta','TypeMismatchError');for(const child of (await service().listDirectory({rootId:this.rootId,parts:this.parts})).entries)yield new NativeHandle({rootId:this.rootId,parts:[...this.parts,child.name],name:child.name,kind:child.kind,nativeLectorHandle:true})}
  async *entries(){for await(const child of this.values())yield [child.name,child]}
  [Symbol.asyncIterator](){return this.entries()}
  async getFileHandle(name){for await(const child of this.values())if(child.name===name&&child.kind==='file')return child;throw new DOMException('Archivo no encontrado','NotFoundError')}
  async getDirectoryHandle(name){for await(const child of this.values())if(child.name===name&&child.kind==='directory')return child;throw new DOMException('Carpeta no encontrada','NotFoundError')}
}
export function reviveNativeHandles(value){
  if(!value||typeof value!=='object')return value
  if(value.nativeLectorHandle&&typeof value.rootId==='string'&&Array.isArray(value.parts))return new NativeHandle(value)
  if(Array.isArray(value))return value.map(reviveNativeHandles)
  if(Object.getPrototypeOf(value)===Object.prototype)return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,reviveNativeHandles(item)]))
  return value
}
export async function chooseNativeFolder(){const data=await service().chooseFolder({});if(!data||data.cancelled)throw new DOMException('Cancelado','AbortError');return new NativeHandle(data)}
