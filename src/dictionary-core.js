export const dictionaryLanguages=['es','ca','en','fr','de','pt','it','zh','ja','hi']
export function normalizeTerm(value,language='es'){
  return String(value??'').normalize('NFC').trim().toLocaleLowerCase(dictionaryLanguages.includes(language)?language:'en').replace(/^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu,'')
}
export function dictionaryBucket(word,buckets=64){let hash=2166136261;for(let index=0;index<word.length;index++)hash=Math.imul(hash^word.charCodeAt(index),16777619)>>>0;return hash%buckets}
export function validateDictionaryEntries(entries,language='es'){
  if(!Array.isArray(entries)||entries.length>100000)throw new Error('El bloque de diccionario no es válido.')
  const result=new Map()
  for(const row of entries){if(!Array.isArray(row)||row.length!==2||typeof row[0]!=='string'||typeof row[1]!=='string'||!row[1].trim()||row[1].length>10000||row[0].length>200)throw new Error('El bloque de diccionario no es válido.')
    const word=normalizeTerm(row[0],language);if(!word)throw new Error('El bloque de diccionario no es válido.');result.set(word,row[1])}
  return result
}
