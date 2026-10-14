import {safeSync,mergeSnapshots} from './sync-core.js'
export const SYNC_LIMIT=10*1024*1024
export async function readSyncJSON(response){
 if(!response.ok)throw new Error('No se pudo conectar con la sincronización.')
 if(Number(response.headers.get('Content-Length'))>SYNC_LIMIT)throw new Error('La sincronización supera 10 MB.')
 const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let length=0,text=''
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>SYNC_LIMIT)throw new Error('La sincronización supera 10 MB.');text+=decoder.decode(value,{stream:true})}}catch(error){await reader.cancel().catch(()=>{});throw error}
 try{return JSON.parse(text+decoder.decode())}catch{throw new Error('Los datos de sincronización no son válidos.')}
}
export function syncURL(value){
 const url=new URL(value)
 if(url.username||url.password||url.search||url.hash||url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('Usa HTTPS para el servidor de sincronización.')
 return url.href
}
export class WebDAVSync{
 constructor(url,username,password){this.url=syncURL(url);this.authorization=username||password?'Basic '+btoa(String.fromCharCode(...new TextEncoder().encode(`${username}:${password}`))):''}
 async request(method,extra={},body,signal){return fetch(this.url,{method,headers:{...(this.authorization?{Authorization:this.authorization}:{}),...extra},body,signal,redirect:'error',credentials:'omit',cache:'no-store'})}
 async read(signal){
  const response=await this.request('GET',{},undefined,signal)
  if(response.status===404)return {data:safeSync({format:'lector-sync',version:1,books:[]}),etag:null}
  const data=safeSync(await readSyncJSON(response)),etag=response.headers.get('ETag')
  if(!etag||!/^"[^"\r\n]{1,200}"$/.test(etag))throw new Error('El servidor debe ofrecer ETag y escrituras condicionales.')
  return {data,etag}
 }
 async write(data,etag,signal){
  const body=JSON.stringify(safeSync(data));if(new Blob([body]).size>SYNC_LIMIT)throw new Error('La sincronización supera 10 MB.')
  const response=await this.request('PUT',{'Content-Type':'application/json',...(etag?{'If-Match':etag}:{'If-None-Match':'*'})},body,signal)
  if([409,412].includes(response.status))throw new Error('Los datos remotos han cambiado. Revisa y sincroniza de nuevo.')
  if(!response.ok)throw new Error('No se pudo conectar con la sincronización.')
 }
 disconnect(){this.authorization=''}
}
const GRAPH='https://graph.microsoft.com/v1.0'
export class OneDriveSync{
 constructor(token,expires,device){this.token=token;this.expires=expires;this.device=device}
 async graph(path,options={}){
  if(!this.token||Date.now()>=this.expires)throw new Error('Vuelve a iniciar sesión en OneDrive.')
  const url=new URL(path,GRAPH+'/');if(url.origin!=='https://graph.microsoft.com'||!url.pathname.startsWith('/v1.0/'))throw new Error('Los datos de sincronización no son válidos.')
  const response=await fetch(url,{...options,headers:{...options.headers,Authorization:'Bearer '+this.token},redirect:'error',credentials:'omit',cache:'no-store'})
  if(!response.ok)throw new Error(response.status===401?'Vuelve a iniciar sesión en OneDrive.':'No se pudo conectar con la sincronización.')
  return response
 }
 async read(signal){
  let url=GRAPH+'/me/drive/special/approot/children?$select=id,name,size,@microsoft.graph.downloadUrl&$top=200',files=[],pages=0
  while(url){if(++pages>10)throw new Error('El catálogo de sincronización es demasiado grande.');const page=await readSyncJSON(await this.graph(url,{signal}));files.push(...page.value);url=page['@odata.nextLink']}
  const pattern=/^lector-([a-f\d-]{36})-(\d{13})-([a-f\d-]{36})\.json$/i,latest=new Map()
  for(const file of files){const match=pattern.exec(file.name??'');if(!match)continue;const previous=latest.get(match[1]);if(!previous||file.name>previous.name)latest.set(match[1],file)}
  if(latest.size>50)throw new Error('El catálogo de sincronización es demasiado grande.')
  let data=safeSync({format:'lector-sync',version:1,books:[]})
  this.ownFiles=files.filter(file=>pattern.exec(file.name??'')?.[1]===this.device).sort((a,b)=>b.name.localeCompare(a.name))
  const snapshots=[...latest.values()].sort((a,b)=>Number(pattern.exec(b.name)[2])-Number(pattern.exec(a.name)[2]))
  for(const file of snapshots){
   if(file.size>SYNC_LIMIT)throw new Error('La sincronización supera 10 MB.')
   const download=new URL(file['@microsoft.graph.downloadUrl']);if(download.protocol!=='https:'||download.username||download.password)throw new Error('Los datos de sincronización no son válidos.')
   // Preauthenticated file URL: never forward the Microsoft bearer token here.
   const snapshot=safeSync(await readSyncJSON(await fetch(download,{signal,redirect:'error',credentials:'omit',cache:'no-store'})))
   data=mergeSnapshots(data,snapshot)
  }
  return {data,etag:null}
 }
 async write(data,_etag,signal){
  const body=JSON.stringify(safeSync(data));if(new Blob([body]).size>SYNC_LIMIT)throw new Error('La sincronización supera 10 MB.')
  // Separate immutable snapshots prevent simultaneous devices overwriting each other.
  const name=`lector-${this.device}-${Date.now()}-${crypto.randomUUID()}.json`
  await this.graph(GRAPH+`/me/drive/special/approot:/${name}:/content`,{method:'PUT',headers:{'Content-Type':'application/json'},body,signal})
  // Keep the new snapshot and two previous copies of this device only.
  // Never delete another device's snapshot, ebooks, or user-selected server files.
  for(const file of (this.ownFiles??[]).slice(2))try{await this.graph(GRAPH+'/me/drive/items/'+encodeURIComponent(file.id),{method:'DELETE',signal})}catch{break}
 }
 disconnect(){this.token='';this.expires=0}
}
export async function oneDriveLogin(clientId,signal){
 if(!/^[a-f\d]{8}-([a-f\d]{4}-){3}[a-f\d]{12}$/i.test(clientId))throw new Error('Configura el identificador público de la aplicación Microsoft.')
 const popup=window.open('about:blank','lector-onedrive','popup,width=520,height=700')
 if(!popup)throw new Error('Permite la ventana de inicio de sesión.')
 const encode=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
 const verifier=encode(crypto.getRandomValues(new Uint8Array(32))),state=encode(crypto.getRandomValues(new Uint8Array(32))),challenge=encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))
 const redirect=new URL('sincronizacion.html',location.href).href,authority='https://login.microsoftonline.com/common/oauth2/v2.0',scope='https://graph.microsoft.com/Files.ReadWrite.AppFolder'
 const parameters=new URLSearchParams({client_id:clientId,response_type:'code',redirect_uri:redirect,response_mode:'query',scope,state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'})
 try{
  const code=await new Promise((resolve,reject)=>{
   let timer
   const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('lector-onedrive-'+state):null
   const cleanup=()=>{window.removeEventListener('message',message);signal?.removeEventListener('abort',cancel);channel?.close();clearTimeout(timer)}
   const fail=error=>{cleanup();reject(error)},cancel=()=>fail(new DOMException('Canceled','AbortError'))
   const accept=data=>{if(data?.type!=='lector-onedrive-callback'||data.state!==state)return;cleanup();data.code?resolve(data.code):reject(new Error('No se completó el inicio de sesión.'))}
   const message=event=>{if(event.origin===location.origin&&event.source===popup)accept(event.data)}
   // Same-origin BroadcastChannel also works after Microsoft COOP severs opener.
   if(channel)channel.onmessage=event=>accept(event.data)
   window.addEventListener('message',message);signal?.addEventListener('abort',cancel,{once:true});timer=setTimeout(()=>fail(new Error('No se completó el inicio de sesión.')),600000)
   popup.location.href=authority+'/authorize?'+parameters
  })
  signal?.throwIfAborted()
  const response=await fetch(authority+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,grant_type:'authorization_code',code,redirect_uri:redirect,code_verifier:verifier,scope}),redirect:'error',credentials:'omit',signal})
  if(!response.ok)throw new Error('No se completó el inicio de sesión.')
  const result=await response.json();if(typeof result.access_token!=='string'||!Number.isFinite(result.expires_in)||result.expires_in<=0)throw new Error('No se completó el inicio de sesión.')
  return {token:result.access_token,expires:Date.now()+result.expires_in*1000-30000}
 }finally{popup.close()}
}
