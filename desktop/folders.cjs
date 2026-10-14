const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto')
function validParts(parts){return Array.isArray(parts)&&parts.length<=100&&parts.every(part=>typeof part==='string'&&part&&part!=='.'&&part!=='..'&&!/[\/\\\0]/.test(part)&&!(process.platform==='win32'&&part.includes(':')))}
function within(root,target){const relative=path.relative(root,target);return !relative.startsWith('..')&&!path.isAbsolute(relative)}
function createFolderStore({file,pick}){
  let roots={},loaded
  async function load(){if(!loaded)loaded=fs.readFile(file,'utf8').then(value=>{roots=JSON.parse(value)},()=>{});await loaded}
  async function resolve({rootId,parts=[]}){await load();const root=roots[rootId];if(!root||!validParts(parts))throw Error('Carpeta no autorizada');const base=await fs.realpath(root),target=await fs.realpath(path.join(base,...parts));if(!within(base,target))throw Error('Ruta fuera de la carpeta elegida');return target}
  return {
    async chooseFolder({rootId}={}){await load();const chosen=await pick();if(!chosen)return null;const root=await fs.realpath(chosen),id=roots[rootId]?rootId:crypto.randomUUID();roots[id]=root;await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(roots),{mode:0o600});return {rootId:id,parts:[],name:path.basename(root),kind:'directory',nativeLectorHandle:true}},
    async permission(data){try{await resolve(data);return {state:'granted'}}catch{return {state:'prompt'}}},
    async listDirectory(data){const directory=await resolve(data),entries=[];for(const item of await fs.readdir(directory,{withFileTypes:true})){if(item.isSymbolicLink())continue;if(item.isDirectory()||item.isFile())entries.push({name:item.name,kind:item.isDirectory()?'directory':'file'})}return {entries}},
    async readFile(data){const filename=await resolve(data),stat=await fs.stat(filename);if(!stat.isFile()||stat.size>100*1024*1024)throw Error('El archivo supera 100 MB.');return {name:path.basename(filename),lastModified:stat.mtimeMs,bytes:new Uint8Array(await fs.readFile(filename))}},
  }
}
module.exports={createFolderStore,validParts,within}
