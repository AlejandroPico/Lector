import {it,expect} from 'vitest'
import {readFile,readdir} from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {normalizeTerm,dictionaryBucket,validateDictionaryEntries,validateGrammarEntries,dictionaryLanguages} from '../src/dictionary-core.js'
import {dictionaryRows} from '../src/i18n-dictionaries.js'

it('preserves Unicode marks and accents in all scripts and validates text only',()=>{
  expect(normalizeTerm('«शांति»','hi')).toBe('शांति');expect(normalizeTerm('ＳＯＳ','ja')).toBe('ｓｏｓ')
  expect(normalizeTerm('cafe\u0301','fr')).toBe('café');expect(normalizeTerm('安静','zh')).toBe('安静')
  expect(validateDictionaryEntries([['CASA','Un hogar.']],'es').get('casa')).toBe('Un hogar.')
  expect(()=>validateDictionaryEntries([['a',{}]])).toThrow();expect(()=>validateDictionaryEntries([['a','x'.repeat(10001)]])).toThrow()
  for(const row of dictionaryRows.trim().split('\n'))expect(row.split('|')).toHaveLength(10)
})
it('rejects malformed grammar while preserving several documented categories and Unicode',()=>{
 expect(validateGrammarEntries([['ESPECIAL',['adj','adv','adj']]],'es').get('especial')).toEqual(['adj','adv'])
 expect(validateGrammarEntries([['किताब',['noun']]],'hi').has('किताब')).toBe(true)
 for(const rows of [[['word',[]]],[['word',['<script>']]],[['word','noun']],[['word',[{}]]]])expect(()=>validateGrammarEntries(rows)).toThrow()
})
it('ships verified grammar for existing headwords in every language, including especial',async()=>{
 for(const language of dictionaryLanguages){
  const pack=JSON.parse(await readFile(`diccionarios/${language}/wiktionary.dictionary.json`)),grammar=pack.grammar
  expect(grammar.entries).toBeGreaterThan(pack.entries*.5);expect(grammar.parts).toHaveLength(pack.buckets);expect(grammar.sourceSHA256).toMatch(/^[a-f\d]{64}$/)
  let count=0,bytes=0
  for(const part of grammar.parts){
   const data=await readFile(`diccionarios/${language}/${part.file}`),raw=gunzipSync(data),words=validateGrammarEntries(JSON.parse(raw),language),definitions=validateDictionaryEntries(JSON.parse(gunzipSync(await readFile(`diccionarios/${language}/${pack.parts[part.bucket].file}`))),language)
   expect(createHash('sha256').update(data).digest('hex')).toBe(part.sha256);expect(createHash('sha256').update(raw).digest('hex')).toBe(part.rawSha256);expect(data.length).toBe(part.bytes);expect(raw.length).toBe(part.rawBytes);expect(words.size).toBe(part.entries)
   expect([...words.keys()].every(word=>dictionaryBucket(word)===part.bucket&&definitions.has(word))).toBe(true)
   if(language==='es'&&words.has('especial'))expect(words.get('especial')).toEqual(['adj','adv'])
   count+=words.size;bytes+=data.length
  }
  expect(count).toBe(grammar.entries);expect(bytes).toBe(grammar.bytes)
 }
},120000)
it('ships ten licensed packages with consistent coverage, sizes and every block checksum',async()=>{
  expect((await readdir('diccionarios')).filter(name=>dictionaryLanguages.includes(name))).toHaveLength(10)
  for(const language of dictionaryLanguages){
    const manifest=JSON.parse(await readFile(`diccionarios/${language}/wiktionary.dictionary.json`))
    expect(manifest.language).toBe(language);expect(manifest.entries).toBeGreaterThan(30000);expect(manifest.license).toBe('CC-BY-SA-4.0');expect(manifest.attribution).toContain('Wiktionary')
    expect(manifest.parts.reduce((sum,part)=>sum+part.entries,0)).toBe(manifest.entries)
    expect(manifest.parts.reduce((sum,part)=>sum+part.bytes,0)).toBe(manifest.bytes)
    for(const part of manifest.parts){const data=await readFile(`diccionarios/${language}/${part.file}`);expect(data.length).toBe(part.bytes);expect(createHash('sha256').update(data).digest('hex')).toBe(part.sha256)}
  }
},30000)
it('contains meaningful lookups for all ten languages, including simplified Chinese and Hindi combining marks',async()=>{
  for(const [language,word] of [['es','sosiego'],['ca','llibre'],['en','book'],['fr','livre'],['de','Haus'],['pt','livro'],['it','libro'],['zh','安静'],['ja','本'],['hi','किताब']]){
    const key=normalizeTerm(word,language),bucket=dictionaryBucket(key),rows=JSON.parse(gunzipSync(await readFile(`diccionarios/${language}/${String(bucket).padStart(2,'0')}.json.gz`)))
    const words=validateDictionaryEntries(rows,language);expect(words.get(key)?.length,`${language}: ${word}`).toBeGreaterThan(3)
    expect([...words.keys()].every(word=>dictionaryBucket(word)===bucket)).toBe(true)
  }
},30000)
