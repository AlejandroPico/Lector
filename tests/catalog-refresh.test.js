import {it,expect} from 'vitest'
import {reconcileCatalog} from '../src/catalog-refresh.js'
import {VisibleCoverQueue} from '../src/cover-queue.js'
const handle=(name,id=name)=>({name,isSameEntry:async other=>id===other.identity,identity:id,getFile(){throw Error('Unexpected content read')}})
const entry=(key='a',formats=['a.epub'])=>({key,path:`Libros/${key}`,title:key,metadata:handle('metadata.opf',key),cover:handle('cover.jpg',key),formats:formats.map(name=>({name,extension:name.split('.').pop(),handle:handle(name)}))})
it('reuses unchanged entries, keeps Calibre identity and reports only added/changed/removed records',async()=>{
  const old=[{...entry(),title:'Personalizado',opfLoaded:true,coverBlob:'cached'},entry('b'),entry('gone')]
  const next=[entry(),entry('b',['b.epub','b.mobi']),entry('new')]
  const result=await reconcileCatalog(old,next)
  expect(result.entries[0]).toBe(old[0]);expect(result.entries[0].coverBlob).toBe('cached')
  expect(result.entries[1].key).toBe('b');expect(result.stats).toEqual({added:1,changed:1,removed:1,unchanged:1})
  expect((await reconcileCatalog(old,old)).dirty).toBe(false)
})
it('invalidates replaced covers and metadata without touching user files',async()=>{
  const old={...entry(),title:'OPF',opfLoaded:true,coverBlob:'cached',tags:['old']},next=entry()
  next.metadata=handle('metadata.opf','replacement');next.cover=handle('cover.jpg','replacement')
  const result=await reconcileCatalog([old],[next])
  expect(result.entries[0].title).toBe('a');expect(result.entries[0].coverBlob).toBeUndefined();expect(result.entries[0].tags).toBeUndefined()
  expect(result.invalidated).toEqual([{key:'a',metadata:true,content:false}])
})
it('cancels before committing a scan',async()=>{const controller=new AbortController();controller.abort();await expect(reconcileCatalog([entry()],[entry()],{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'})})
it('loads only intersecting covers, skips offscreen items and does not complete canceled jobs',async()=>{
  let observer,finish;const loaded=[],done=[]
  class Observer{constructor(callback){this.callback=callback;observer=this}observe(){}disconnect(){}}
  const queue=new VisibleCoverQueue({Observer,load:(item)=>{loaded.push(item.id);return new Promise(resolve=>finish=resolve)},done:item=>done.push(item.id)})
  const a={},b={};queue.observe(new Map([[a,{id:'a'}],[b,{id:'b'}]]),true)
  observer.callback([{target:a,isIntersecting:true},{target:b,isIntersecting:false}]);expect(loaded).toEqual(['a'])
  queue.cancel();finish();await new Promise(resolve=>setTimeout(resolve,0));expect(done).toEqual([]);expect(loaded).toEqual(['a'])
})
