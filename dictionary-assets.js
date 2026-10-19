import {readdirSync} from 'node:fs'
import {resolve,relative} from 'node:path'
// One URL map avoids importing a JavaScript wrapper for every compressed block in dev.
export function dictionaryAssets(){
 const root=resolve('diccionarios'),moduleFile=resolve('src/dictionary-asset-urls.js')
 function files(directory){return readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>entry.isDirectory()?files(resolve(directory,entry.name)):/\.(json|gz)$/.test(entry.name)?[resolve(directory,entry.name)]:[])}
 return {name:'dictionary-asset-urls',enforce:'pre',transform(code,id){
  if(id.split('?')[0].replaceAll('\\','/')!==moduleFile.replaceAll('\\','/'))return
  const entries=files(root).map(path=>{const key='../diccionarios/'+relative(root,path).replaceAll('\\','/');return `${JSON.stringify(key)}:new URL(${JSON.stringify(key)},import.meta.url).href`})
  return {code:`export const dictionaryFiles={${entries.join(',')}}`,map:null}
 }}
}
