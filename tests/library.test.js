import {describe,it,expect} from 'vitest'
import {recentReadingOrder} from '../src/library.js'

it('orders actual reading before untouched alphabetical titles, ignoring metadata and note updates',()=>{
  const items=[{title:'Zulu',updatedAt:9999},{title:'Alfa'},{title:'Primero',lastReadAt:2},{title:'Segundo',lastReadAt:1,updatedAt:99999}]
  expect(recentReadingOrder(items).map(item=>item.title)).toEqual(['Primero','Segundo','Alfa','Zulu'])
  expect(items[0].title).toBe('Zulu')
})
import {catalogMetadata,libraryEntries,filterLibrary,duplicateGroups,languageCode} from '../src/library.js'
import {readMetadata} from '../src/folders.js'
import {libraryRows} from '../src/i18n-library.js'

const metadata=xml=>readMetadata({metadata:{getFile:async()=>({size:xml.length,text:async()=>xml})}})
describe('catalog metadata and organization',()=>{
  it('reads Calibre tags, series and genre columns as data',async()=>{
    const result=await metadata(`<package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>Viaje</dc:title><dc:creator>Autora</dc:creator><dc:creator>Coautor</dc:creator><dc:language>spa</dc:language><dc:language>eng</dc:language><dc:subject>Ciencia, tecnología</dc:subject><dc:identifier>ISBN:123</dc:identifier><meta name="calibre:series" content="Viajes"/><meta name="calibre:series_index" content="2.5"/><meta name="calibre:user_metadata:#genre" content='{&quot;#value#&quot;:[&quot;Historia&quot;,&quot;Aventura&quot;]}'/></metadata></package>`)
    expect(result).toMatchObject({author:'Autora, Coautor',authors:['Autora','Coautor'],tags:['Ciencia, tecnología'],genres:['Historia','Aventura'],series:'Viajes',seriesIndex:2.5})
    expect(catalogMetadata(result)).toMatchObject({languages:['es','en'],identifiers:['isbn:123']})
    expect(languageCode('ca-ES')).toBe('ca')
  })
  it('reads EPUB3 series refinements and ignores other collections and executable custom values',async()=>{
    const result=await metadata(`<package><metadata><meta id="other" property="belongs-to-collection">Set</meta><meta refines="#other" property="collection-type">set</meta><meta id="s" property="belongs-to-collection">Serie</meta><meta refines="#s" property="collection-type">series</meta><meta refines="#s" property="group-position">10</meta><meta name="calibre:user_metadata:#genre" content='{&quot;#value#&quot;:{&quot;template&quot;:&quot;throw new Error()&quot;}}'/></metadata></package>`)
    expect(result.series).toBe('Serie');expect(result.seriesIndex).toBe(10);expect(result.genres).toBeUndefined()
    expect(catalogMetadata({seriesIndex:null}).seriesIndex).toBeNull()
    expect(catalogMetadata({seriesIndex:'bad'}).seriesIndex).toBeNull()
  })
  it('keeps virtual organization separate and deduplicates only cached local entries linked to the same folder item',()=>{
    const folders=[{id:'f',entries:[{key:'one',title:'Uno',language:'es',formats:[{extension:'epub'},{extension:'mobi'}]}]}]
    const items=libraryEntries([{id:'abc',folderId:'f',entryKey:'one',coverBlob:'cached'}, {id:'orphan',folderId:'gone',entryKey:'two',title:'Dos',filename:'two.pdf'}],folders,[{id:'f:one',status:'finished',collections:['c'],overrides:{author:'B',language:'',genres:['Historia'],series:'S',seriesIndex:2}}])
    expect(items).toHaveLength(2)
    expect(items.find(item=>item.id==='f:one')).toMatchObject({coverBlob:'cached',status:'finished',authors:['B'],language:'',languages:[],genres:['Historia'],formatNames:['epub','mobi'],collections:['c']})
    expect(folders[0].entries[0].author).toBeUndefined()
  })
  it('filters a five-thousand-book catalog and sorts series by numeric position',()=>{
    const books=Array.from({length:5000},(_,index)=>({id:String(index),title:`Libro ${index}`,author:index%2?'Álex':'Bea',filename:index%2?'book.epub':'book.pdf'}))
    const states=books.map((book,index)=>({id:book.id,status:index%2?'reading':'pending',collections:index%3?[]:['collection'],metadata:{title:book.title,author:book.author,series:'Saga',seriesIndex:5000-index,tags:['Ciencia, tecnología'],genres:index%2?['Historia']:['Novela'],language:index%2?'spa':'eng'}}))
    const items=libraryEntries(books,[],states)
    const result=filterLibrary(items,{author:'alex',genre:'Historia',tag:'Ciencia, tecnología',language:'es',format:'epub',status:'reading',collection:'collection',series:'Saga',sort:'series'})
    expect(result).toHaveLength(833);expect(result[0].seriesIndex).toBe(5)
    expect(filterLibrary(items,{query:'libro 49'})).toHaveLength(111)
  })
  it('reports possible editions and identical opened files without deleting or collapsing entries',()=>{
    const hash='a'.repeat(64)
    const items=[{id:'1',title:'Árbol',author:'A'},{id:'2',title:'Arbol',author:'A'},{id:'3',title:'Otra edición',identifiers:['isbn:1']},{id:'4',title:'Edición',identifiers:['ISBN:1']},{id:'5',fingerprints:[hash]},{id:'6',fingerprints:[hash]},{id:'7',title:'Árbol',author:'B'},{id:'8',title:'Sin autor'},{id:'9',title:'Sin autor'}]
    expect(duplicateGroups(items).map(group=>group.map(item=>item.id))).toEqual([['1','2'],['3','4'],['5','6']]);expect(items).toHaveLength(9)
  })
  it('supplies every new message in the ten interface languages',()=>{
    for(const row of libraryRows.trim().split('\n'))expect(row.split('|')).toHaveLength(10)
  })
})
