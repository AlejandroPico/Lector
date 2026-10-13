const manifests=import.meta.glob('../diccionarios/**/*.dictionary.json',{eager:true,import:'default'})
const files=import.meta.glob('../diccionarios/**/*.{json,gz}',{eager:true,query:'?url',import:'default'})
export const projectDictionaries=Object.entries(manifests).map(([path,manifest])=>({...manifest,project:true,parts:manifest.parts?.map(part=>({...part,url:files[path.slice(0,path.lastIndexOf('/')+1)+part.file]}))}))
export const personalProjectDictionaries=Object.entries(files).filter(([path])=>path.endsWith('.json')&&!path.endsWith('.dictionary.json')).map(([path,url])=>({path,url,name:path.split('/').at(-1),language:path.split('/').find(part=>['es','ca','en','fr','de','pt','it','zh','ja','hi'].includes(part))}))
