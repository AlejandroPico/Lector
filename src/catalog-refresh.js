const signature=entry=>JSON.stringify([entry.path,entry.metadata?.name,entry.cover?.name,entry.formats.map(format=>[format.extension,format.name])])
const sameHandle=async(a,b)=>!a&&!b||Boolean(a&&b&&(a===b||typeof a.isSameEntry==='function'&&await a.isSameEntry(b)))
const check=signal=>{if(signal?.aborted)throw new DOMException('Cancelled','AbortError')}

// File identity can be checked without getFile(), which might hydrate a cloud file.
export async function reconcileCatalog(previous,next,{signal}={}){
  const byKey=new Map(previous.map(entry=>[entry.key,entry])),byPath=new Map(previous.filter(entry=>entry.metadata).map(entry=>[entry.path,entry]))
  const seen=new Set(),entries=[],invalidated=[]
  const stats={added:0,changed:0,removed:0,unchanged:0}
  for(const entry of next){
    check(signal)
    const old=byKey.get(entry.key)??(entry.metadata&&byPath.get(entry.path))
    if(!old){entries.push(entry);stats.added++;continue}
    seen.add(old.key)
    const metadataSame=await sameHandle(old.metadata,entry.metadata),coverSame=await sameHandle(old.cover,entry.cover)
    const formats=new Map(old.formats.map(format=>[format.name,format]))
    let contentSame=true
    for(const format of entry.formats){const prior=formats.get(format.name);if(prior&&!await sameHandle(prior.handle,format.handle))contentSame=false}
    check(signal)
    const changed=signature(old)!==signature(entry)||!metadataSame||!coverSame||!contentSame
    if(!changed){entries.push(old);stats.unchanged++;continue}
    stats.changed++
    const merged={...old,...entry,key:old.key,coverBlob:coverSame&&contentSame?old.coverBlob:undefined,coverInvalidated:old.coverInvalidated||!coverSame||!contentSame}
    if(metadataSame&&old.opfLoaded){for(const key of ['title','author','language'])merged[key]=old[key]}
    if(!metadataSame){for(const key of ['opfLoaded','series','seriesIndex','tags','genres','languages','authors','identifiers'])delete merged[key]}
    if(!contentSame)delete merged.hashes
    if(!metadataSame||!contentSame)invalidated.push({key:old.key,metadata:!metadataSame,content:!contentSame})
    entries.push(merged)
  }
  stats.removed=previous.filter(entry=>!seen.has(entry.key)).length
  return {entries,stats,invalidated,dirty:Boolean(stats.added||stats.changed||stats.removed)}
}
