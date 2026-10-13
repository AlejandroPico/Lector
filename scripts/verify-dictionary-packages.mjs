import {readFile,writeFile} from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
import {dictionaryLanguages,dictionaryBucket,validateDictionaryEntries} from '../src/dictionary-core.js'
for(const language of dictionaryLanguages){
  const path=resolve(import.meta.dirname,`../diccionarios/${language}/wiktionary.dictionary.json`),manifest=JSON.parse(await readFile(path));let entries=0
  for(const part of manifest.parts){
    const compressed=await readFile(resolve(path,'..',part.file)),data=gunzipSync(compressed),hash=buffer=>createHash('sha256').update(buffer).digest('hex')
    if(compressed.length!==part.bytes||hash(compressed)!==part.sha256||data.length!==part.rawBytes)throw Error(`Invalid asset: ${language}/${part.file}`)
    const rows=JSON.parse(data),words=validateDictionaryEntries(rows,language)
    if(words.size!==part.entries||[...words.keys()].some(word=>dictionaryBucket(word,manifest.buckets)!==part.bucket))throw Error(`Invalid index: ${language}/${part.file}`)
    part.rawSha256=hash(data);entries+=words.size
  }
  if(entries!==manifest.entries)throw Error(`Invalid coverage: ${language}`)
  await writeFile(path,JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({language,entries,verified:true}))
}
