import {Readable} from 'node:stream'
import {createGunzip,gzipSync} from 'node:zlib'
import {createInterface} from 'node:readline'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {normalizeTerm,dictionaryBucket} from '../src/dictionary-core.js'

const root=resolve(import.meta.dirname,'../diccionarios'),date=new Date().toISOString().slice(0,10)
const native=['es','it','pt','ja','zh','de','fr'].map(language=>({language,definitionLanguage:language,edition:language,url:`https://kaikki.org/dictionary/downloads/${language}/${language}-extract.jsonl.gz`}))
const english=[['ca','Catalan'],['hi','Hindi'],['en','English']].map(([language,name])=>({language,definitionLanguage:'en',edition:'en',url:`https://kaikki.org/dictionary/${name}/kaikki.org-dictionary-${name}.jsonl.gz`}))
const selected=new Set(process.argv.slice(2)),sources=[...native,...english].filter(source=>!selected.size||selected.has(source.language))
for(const source of sources){
  const directory=resolve(root,source.language),manifestPath=resolve(directory,'wiktionary.dictionary.json')
  if(!process.env.LECTOR_REBUILD_DICTIONARIES){try{const old=JSON.parse(await readFile(manifestPath));console.log(JSON.stringify({language:source.language,cached:true,entries:old.entries}));continue}catch{}}
  await mkdir(directory,{recursive:true})
  const response=await fetch(source.url);if(!response.ok)throw new Error(`Dictionary HTTP ${response.status}: ${source.language}`)
  const input=Readable.fromWeb(response.body),unzip=createGunzip();input.pipe(unzip)
  input.on('error',error=>unzip.destroy(error))
  const lines=createInterface({input:unzip,crlfDelay:Infinity}),words=new Map();let records=0,invalidRows=0,last=Date.now()
  for await(const line of lines){
    if(!line.trim())continue
    let row;try{row=JSON.parse(line)}catch{invalidRows++;continue}records++
    if(row.lang_code===source.language&&typeof row.word==='string'&&row.word.length<=200){
      const word=normalizeTerm(row.word,source.language)
      const glosses=(row.senses??[]).flatMap(sense=>sense.glosses?.length?sense.glosses:sense.raw_glosses??[]).filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim().slice(0,1500))
      if(word&&glosses.length){
        const aliases=source.language==='zh'?(row.forms??[]).filter(form=>form.tags?.some(tag=>/^(Simplified|Traditional)-Chinese$/.test(tag))&&typeof form.form==='string').map(form=>normalizeTerm(form.form,'zh')):[]
        for(const key of [word,...aliases].filter(Boolean)){const prior=words.get(key)??[];words.set(key,[...new Set([...prior,...glosses])].slice(0,12))}
      }
    }
    if(Date.now()-last>20000){console.log(JSON.stringify({language:source.language,records,words:words.size,working:true}));last=Date.now()}
  }
  if(words.size<1000)throw new Error(`Insufficient dictionary coverage: ${source.language}: ${words.size}`)
  if(invalidRows>Math.max(10,records*0.001))throw new Error(`Malformed source rows: ${source.language}: ${invalidRows}`)
  const buckets=Array.from({length:64},()=>[])
  for(const [word,glosses] of words)buckets[dictionaryBucket(word)].push([word,glosses.map((value,index)=>`${index+1}. ${value}`).join('\n').slice(0,10000)])
  const parts=[]
  for(let bucket=0;bucket<64;bucket++){
    buckets[bucket].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0)
    const data=Buffer.from(JSON.stringify(buckets[bucket])),compressed=gzipSync(data,{level:9}),file=`${String(bucket).padStart(2,'0')}.json.gz`
    if(data.length>32*1024*1024||compressed.length>8*1024*1024)throw new Error(`Oversized dictionary bucket: ${source.language}`)
    await writeFile(resolve(directory,file),compressed)
    parts.push({file,bucket,entries:buckets[bucket].length,bytes:compressed.length,rawBytes:data.length,sha256:createHash('sha256').update(compressed).digest('hex'),rawSha256:createHash('sha256').update(data).digest('hex')})
  }
  const revision=createHash('sha256').update(parts.map(part=>part.sha256).join('')).digest('hex').slice(0,12)
  const manifest={schema:1,id:`wiktionary-${source.language}-${revision}`,name:'Wiktionary',language:source.language,definitionLanguage:source.definitionLanguage,edition:source.edition,entries:words.size,bytes:parts.reduce((sum,part)=>sum+part.bytes,0),date,
    source:source.url,sourcePage:'https://kaikki.org/dictionary/rawdata.html',entryBase:`https://${source.edition}.wiktionary.org/wiki/`,license:'CC-BY-SA-4.0',licenseURL:'https://creativecommons.org/licenses/by-sa/4.0/',attribution:'Wiktionary contributors; extraction by Wiktextract / Kaikki.org',changes:'Normalized headwords; plain-text glosses grouped by headword, at most twelve glosses and 10000 characters; Chinese orthographic variants retained; other fields omitted.',invalidRows,buckets:64,parts}
  await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n')
  console.log(JSON.stringify({language:source.language,complete:true,entries:manifest.entries,bytes:manifest.bytes}))
}
