export const statuses={pending:'Pendiente',reading:'Leyendo',finished:'Terminado',abandoned:'Abandonado'}
export const normalize=text=>String(text??'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase().trim().replace(/\s+/g,' ')
const text=value=>typeof value==='string'?value:typeof value==='number'?String(value):Array.isArray(value)?value.map(text).filter(Boolean).join(', '):value&&typeof value==='object'?text(value.name??value.value??value.es??value.en??Object.values(value)[0]):''
export const labels=value=>[...new Set((Array.isArray(value)?value:[value]).map(text).map(value=>value.trim().slice(0,160)).filter(Boolean))].slice(0,100)
export function languageCode(value){const code=text(value).split(/[,\s_-]/)[0].toLowerCase();return ({spa:'es',cat:'ca',eng:'en',fra:'fr',fre:'fr',deu:'de',ger:'de',por:'pt',ita:'it',zho:'zh',chi:'zh',jpn:'ja',hin:'hi'})[code]??code}
export function catalogMetadata(raw={}){
  const series=Array.isArray(raw.belongsTo?.series)?raw.belongsTo.series[0]:raw.belongsTo?.series
  const rawPosition=raw.seriesIndex??series?.position
  const position=rawPosition===undefined||rawPosition===null||rawPosition===''?NaN:Number(rawPosition)
  const languages=labels(raw.languages??raw.language).map(languageCode).filter(Boolean)
  const identifiers=labels([raw.identifier,...(Array.isArray(raw.identifiers)?raw.identifiers:[]),...(Array.isArray(raw.altIdentifier)?raw.altIdentifier:[])]).map(value=>value.toLowerCase())
  return {title:text(raw.title).trim().slice(0,300),author:text(raw.author??raw.authors).trim().slice(0,400),authors:labels(raw.authors??raw.author),language:languages[0]??'',languages,
    tags:labels(raw.tags??raw.subject),genres:labels(raw.genres??raw.genre),series:text(raw.series??series?.name).trim().slice(0,160),
    seriesIndex:Number.isFinite(position)?position:null,identifiers}
}
export const catalogKey=book=>book.folderId&&book.entryKey?`${book.folderId}:${book.entryKey}`:book.id
export function recentReadingOrder(items,locale='es') {
  const collator=new Intl.Collator(locale,{numeric:true,sensitivity:'base'})
  return [...items].sort((a,b)=>(b.lastReadAt??0)-(a.lastReadAt??0)||collator.compare(a.title??'',b.title??''))
}
export function libraryEntries(books,folders,records){
  const stored=new Map(records.map(record=>[record.id,record])),opened=new Map(),byHash=new Map(books.map(book=>[book.id,book])),aliases=new Map()
  for(const book of books.filter(book=>book.folderId)){const key=catalogKey(book);opened.set(key,[...(opened.get(key)??[]),book])}
  const linked=folders.flatMap(folder=>folder.entries.map(entry=>{
    const id=`${folder.id}:${entry.key}`,hashes=[...Object.values(entry.hashes??{}),...(stored.get(id)?.fingerprints??[])].filter(hash=>typeof hash==='string'&&/^[a-f\d]{64}$/i.test(hash)).map(hash=>hash.toLowerCase())
    const readings=[...new Set([...(opened.get(id)??[]),...hashes.map(hash=>byHash.get(hash)).filter(Boolean)])].sort((a,b)=>(b.lastReadAt??b.updatedAt??0)-(a.lastReadAt??a.updatedAt??0)),saved=readings[0]
    for(const reading of readings)aliases.set(reading.id,id)
    return {...entry,folder,id,kind:'folder',savedId:saved?.id,coverBlob:entry.coverBlob??(!entry.coverInvalidated?saved?.coverBlob:undefined),lastReadAt:saved?.lastReadAt,cfi:saved?.cfi,coverSeen:saved?.coverSeen,fraction:saved?.fraction}
  }))
  const linkedIDs=new Set(linked.map(item=>item.id))
  const linkedFolders=new Set(folders.map(folder=>folder.id))
  return [...books.filter(book=>!aliases.has(book.id)&&!linkedIDs.has(catalogKey(book))&&(!book.folderId||!linkedFolders.has(book.folderId))).map(book=>({...book,kind:'local'})),...linked].map(base=>{
    // A cached reading and its folder entry are one book, identified by bytes or
    // an explicit folder link, never by a potentially shared title or filename.
    const fallback=stored.get(base.savedId)??{},primary=stored.get(base.id)??{},state={...fallback,...primary,overrides:{...fallback.overrides,...primary.overrides}},metadata=catalogMetadata(state.metadata??base),overrides=state.overrides??{}
    const formats=base.formats?.map(format=>format.extension)??[base.filename?.split('.').pop()?.toLowerCase()].filter(Boolean)
    return {...base,lastReadAt:base.lastReadAt??(base.coverSeen!==false&&base.cfi?1:0),...Object.fromEntries(Object.entries(metadata).filter(([,value])=>Array.isArray(value)?value.length:value!==''&&value!==null)),...overrides,
      authors:labels(overrides.author??metadata.authors),tags:labels(overrides.tags??metadata.tags),genres:labels(overrides.genres??metadata.genres),formatNames:formats,
      language:languageCode(overrides.language??metadata.language),languages:Object.hasOwn(overrides,'language')?[languageCode(overrides.language)].filter(Boolean):metadata.languages,
      status:Object.hasOwn(statuses,state.status)?state.status:base.coverSeen!==false&&base.cfi?'reading':'pending',collections:labels(state.collections),
      fingerprints:[...new Set([...(state.fingerprints??[]),...Object.values(base.hashes??{}),...(base.kind==='local'&&/^[a-f\d]{64}$/.test(base.id)?[base.id]:[])])],catalog:state}
  })
}
export function duplicateGroups(items){
  const parent=new Map(items.map(item=>[item.id,item.id])),keys=new Map()
  const root=id=>{let current=id;while(parent.get(current)!==current)current=parent.get(current);while(id!==current){const next=parent.get(id);parent.set(id,current);id=next}return current}
  for(const item of items){
    const fingerprints=(item.fingerprints??[]).filter(hash=>/^[a-f\d]{64}$/i.test(hash)).map(hash=>`file:${hash.toLowerCase()}`)
    const identifiers=(item.identifiers??[]).filter(Boolean).map(value=>`identifier:${normalize(value)}`)
    const title=normalize(item.title),author=normalize(item.author)
    for(const key of [...fingerprints,...identifiers,...(title&&author?[`title:${title}|${author}`]:[])]){
      if(keys.has(key))parent.set(root(item.id),root(keys.get(key)));else keys.set(key,item.id)
    }
  }
  const groups=new Map()
  for(const item of items){const id=root(item.id);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(item)}
  return [...groups.values()].filter(group=>group.length>1)
}
export function filterLibrary(items,filters={},locale='es',duplicates=new Set()){
  const same=(a,b)=>normalize(a)===normalize(b),has=(values,value)=>labels(values).some(item=>same(item,value))
  const query=normalize(filters.query)
  const result=items.filter(item=>(!query||normalize([item.title,item.author,item.series,...item.tags,...item.genres].join(' ')).includes(query))
    &&(!filters.author||same(item.author,filters.author)||has(item.authors,filters.author))&&(!filters.series||same(item.series,filters.series))
    &&(!filters.genre||has(item.genres,filters.genre))&&(!filters.tag||has(item.tags,filters.tag))
    &&(!filters.language||has(item.languages?.length?item.languages:[item.language],filters.language))
    &&(!filters.format||item.formatNames.includes(filters.format))&&(!filters.status||item.status===filters.status)
    &&(!filters.collection||item.collections.includes(filters.collection))&&(!filters.duplicates||duplicates.has(item.id)))
  const collator=new Intl.Collator(locale,{numeric:true,sensitivity:'base'}),compare=(a,b)=>collator.compare(a??'',b??'')
  return result.sort((a,b)=>filters.sort==='recent'?(b.updatedAt??0)-(a.updatedAt??0)||compare(a.title,b.title)
    :filters.sort==='author'?compare(a.author,b.author)||compare(a.title,b.title)
    :filters.sort==='series'?(!a.series)-(!b.series)||compare(a.series,b.series)||(a.seriesIndex??Infinity)-(b.seriesIndex??Infinity)||compare(a.title,b.title)
    :compare(a.title,b.title))
}
