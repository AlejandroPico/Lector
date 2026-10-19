// Preserve the dictionary texts; add only grammar explicitly supplied by Wiktextract.
import {Readable} from 'node:stream'
import {createReadStream,existsSync} from 'node:fs'
import {createGunzip,gunzipSync,gzipSync} from 'node:zlib'
import {createInterface} from 'node:readline'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {tmpdir} from 'node:os'
import {createHash} from 'node:crypto'
import {normalizeTerm,dictionaryLanguages} from '../src/dictionary-core.js'
const root=resolve(import.meta.dirname,'../diccionarios'),selected=new Set(process.argv.slice(2)),sha=data=>createHash('sha256').update(data).digest('hex')
for(const language of dictionaryLanguages.filter(language=>!selected.size||selected.has(language))){
 const path=join(root,language,'wiktionary.dictionary.json'),manifest=JSON.parse(await readFile(path))
 if(manifest.grammar&&!process.env.LECTOR_REBUILD_GRAMMAR){console.log(JSON.stringify({language,cached:true}));continue}
 const cached=join(process.env.LECTOR_GRAMMAR_SOURCES??join(tmpdir(),'lector-dictionary-research'),language+'.jsonl.gz')
 let input
 if(existsSync(cached))input=createReadStream(cached)
 else {const response=await fetch(manifest.source);if(!response.ok)throw Error(`Grammar HTTP ${response.status}: ${language}`);input=Readable.fromWeb(response.body)}
 const hash=createHash('sha256'),unzip=createGunzip();input.on('data',chunk=>hash.update(chunk));input.on('error',error=>unzip.destroy(error));input.pipe(unzip)
 const words=new Map();let records=0,invalid=0,last=Date.now()
 for await(const line of createInterface({input:unzip,crlfDelay:Infinity})){
  if(!line.trim())continue
  let row;try{row=JSON.parse(line)}catch{invalid++;continue}records++
  if(row.lang_code===language&&typeof row.word==='string'&&row.word.length<=200&&typeof row.pos==='string'&&/^[a-z][a-z_-]{0,39}$/.test(row.pos)){
   const aliases=language==='zh'?(row.forms??[]).filter(form=>form.tags?.some(tag=>/^(Simplified|Traditional)-Chinese$/.test(tag))&&typeof form.form==='string').map(form=>form.form):[]
   for(const word of [row.word,...aliases]){const key=normalizeTerm(word,language);if(!key)continue;const parts=words.get(key)??new Set();parts.add(row.pos);words.set(key,parts)}
  }
  if(Date.now()-last>20000){console.log(JSON.stringify({language,records,words:words.size,working:true}));last=Date.now()}
 }
 if(words.size<1000||invalid>Math.max(10,records*.001))throw Error(`Insufficient grammar: ${language}`)
 await mkdir(join(root,language,'grammar'),{recursive:true});const parts=[]
 for(const block of manifest.parts){
  const rows=JSON.parse(gunzipSync(await readFile(join(root,language,block.file)))).filter(([word])=>words.has(word)).map(([word])=>[word,[...words.get(word)].sort()])
  const raw=Buffer.from(JSON.stringify(rows)),compressed=gzipSync(raw,{level:9}),file=`grammar/${String(block.bucket).padStart(2,'0')}.json.gz`
  await writeFile(join(root,language,file),compressed)
  parts.push({bucket:block.bucket,file,entries:rows.length,bytes:compressed.length,rawBytes:raw.length,sha256:sha(compressed),rawSha256:sha(raw)})
 }
 const entries=parts.reduce((sum,part)=>sum+part.entries,0),bytes=parts.reduce((sum,part)=>sum+part.bytes,0)
 manifest.grammar={schema:1,date:new Date().toISOString().slice(0,10),source:manifest.source,sourceSHA256:hash.digest('hex'),entries,bytes,parts}
 // A separate identity keeps existing installations intact and makes the new package explicit.
 manifest.id=manifest.id.replace(/-grammar-\w+$/,'')+'-grammar-'+sha(Buffer.from(JSON.stringify(parts))).slice(0,8)
 await writeFile(path,JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({language,entries,bytes,complete:true}))
}
