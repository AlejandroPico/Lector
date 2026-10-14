import {it,expect,vi,afterEach} from 'vitest'
import {safeSync,snapshot,mergeSnapshots,positionConflicts,applyPortable,portablePreferences} from '../src/sync-core.js'
import {WebDAVSync,OneDriveSync,syncURL,readSyncJSON} from '../src/sync-services.js'
const id='a'.repeat(64),empty=()=>({format:'lector-sync',version:1,books:[]}),data=(notes=[],cfi='epubcfi(/6/2!/4/2:0)',at=100)=>({format:'lector-sync',version:1,books:[{id,title:'Book',notes,position:{cfi,fraction:.2,updatedAt:at}}]})
const note=(text,at=100)=>({id:'one',kind:'note',cfi:'epubcfi(/6/2!/4/2:0)',text,color:'pink',updatedAt:at,createdAt:1})
afterEach(()=>vi.unstubAllGlobals())
it('exports only selected portable data and excludes all files, tokens and service configuration',()=>{
 const result=snapshot([{id,title:'Book',notes:[note('private')],file:new Blob(['secret book']),coverBlob:new Blob(),fileHandle:{},anchorCFI:'epubcfi(/6/2!/4/2:0)',lastReadAt:100}],{fontSize:25,provider:'openai',apiKey:'secret',endpoint:'https://private',pronunciations:[{from:'secret'}]},{positions:false,notes:false,preferences:true})
 expect(result.books).toEqual([]);expect(result.preferences).toEqual({fontSize:25});expect(JSON.stringify(result)).not.toContain('secret')
 expect(snapshot([{id,notes:[note('private')]}],{},{positions:true,notes:false}).books[0].notes).toEqual([])
})
it('merges notes by stable ID and retains newer edits while tombstones prevent resurrection',()=>{
 const local=data([note('old',100)]),remote=data([note('new',200),{...note('second',300),id:'two'}]);let result=mergeSnapshots(local,remote);expect(result.books[0].notes.map(note=>note.text)).toEqual(['new','second'])
 remote.books[0].deletedNotes=[{id:'one',updatedAt:201}];result=mergeSnapshots(local,remote);expect(result.books[0].notes.map(note=>note.id)).toEqual(['two']);expect(mergeSnapshots(result,local).books[0].notes.map(note=>note.id)).toEqual(['two'])
})
it('reports position conflicts and honors a decision over the timestamp default',()=>{
 const local=data([],'epubcfi(/6/2!/4/2:0)',100),remote=data([],'epubcfi(/6/4!/4/2:0)',200)
 expect(positionConflicts(safeSync(local),safeSync(remote))).toHaveLength(1);expect(mergeSnapshots(local,remote,{[id]:'local'}).books[0].position.cfi).toBe(local.books[0].position.cfi);expect(mergeSnapshots(local,remote,{[id]:'remote'}).books[0].position.cfi).toBe(remote.books[0].position.cfi)
})
it('applies notes without replacing an original file or reviving a deletion made during syncing',()=>{
 const file=new Blob(['original']),local={id,file,notes:[],deletedNotes:[{id:'one',updatedAt:300}],anchorCFI:'current'},portable=safeSync(data([note('remote',100)])).books[0]
 const result=applyPortable(local,portable,{notes:true,positions:false});expect(result.file).toBe(file);expect(result.anchorCFI).toBe('current');expect(result.notes).toEqual([])
})
it('bounds unsupported schemas, book identifiers, notes and imported appearance settings',()=>{
 expect(()=>safeSync({format:'other',version:1,books:[]})).toThrow();expect(safeSync({format:'lector-sync',version:1,books:[{id:'../bad',notes:[]}]}).books).toEqual([])
 const preferences=portablePreferences({customThemes:[{id:'personal-test',label:'Own',colors:Array(8).fill('#000000')},{id:'bad',label:'CSS',colors:['url(secret)']}],fontSize:20,apiKey:'private'});expect(preferences.customThemes).toHaveLength(1);expect(preferences.apiKey).toBeUndefined();expect(safeSync(data([note('safe')])).books[0].notes[0].color).toBe('pink')
})
it('requires HTTPS except loopback and rejects URL credentials and secret query parameters',()=>{
 expect(syncURL('https://my.example/dav/reader.json')).toBe('https://my.example/dav/reader.json');expect(syncURL('http://127.0.0.1:5060/test')).toContain('5060')
 for(const value of ['http://192.168.1.8/test','https://user:password@my.example/test','https://my.example?key=secret','javascript:alert(1)'])expect(()=>syncURL(value)).toThrow()
})
it('WebDAV uses conditional updates and rejects concurrent writes without losing remote data',async()=>{
 const fetch=vi.fn(async(_url,options)=>options.method==='GET'?new Response(JSON.stringify(empty()),{headers:{ETag:'"version1"'}}):new Response('',{status:412}));vi.stubGlobal('fetch',fetch)
 const service=new WebDAVSync('https://private.example/lector.json','user','session-password'),remote=await service.read();await expect(service.write(remote.data,remote.etag)).rejects.toThrow('cambiado');expect(fetch.mock.calls[1][1].headers['If-Match']).toBe('"version1"');expect(fetch.mock.calls[1][1].redirect).toBe('error');service.disconnect();expect(service.authorization).toBe('')
})
it('a new WebDAV document uses If-None-Match and refuses servers without strong ETags',async()=>{
 const fetch=vi.fn(async(_url,options)=>options.method==='GET'?new Response(JSON.stringify(empty())):new Response(null,{status:201}));vi.stubGlobal('fetch',fetch)
 const service=new WebDAVSync('https://private.example/lector.json','','');await expect(service.read()).rejects.toThrow('ETag');await service.write(empty(),null);expect(fetch.mock.calls[1][1].headers['If-None-Match']).toBe('*')
})
it('OneDrive reads only app snapshots and never forwards its bearer token to download URLs',async()=>{
 const filename='lector-11111111-1111-4111-8111-111111111111-1760000000000-22222222-2222-4222-8222-222222222222.json'
 const fetch=vi.fn(async(url)=>String(url).startsWith('https://graph.microsoft.com')?new Response(JSON.stringify({value:[{name:'my-book.epub',size:50000},{name:filename,size:300,'@microsoft.graph.downloadUrl':'https://download.example/preauthenticated'}]})):new Response(JSON.stringify(data([note('remote')]))));vi.stubGlobal('fetch',fetch)
 const service=new OneDriveSync('session-token',Date.now()+60000,'33333333-3333-4333-8333-333333333333'),remote=await service.read();expect(remote.data.books[0].notes[0].text).toBe('remote');expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer session-token');expect(fetch.mock.calls[1][1].headers).toBeUndefined();service.disconnect();await expect(service.read()).rejects.toThrow('sesión')
})
it('OneDrive writes an independent snapshot instead of overwriting another device',async()=>{
 const fetch=vi.fn(async()=>new Response('{}'));vi.stubGlobal('fetch',fetch);const service=new OneDriveSync('token',Date.now()+60000,'33333333-3333-4333-8333-333333333333');await service.write(empty());expect(String(fetch.mock.calls[0][0])).toMatch(/special\/approot:\/lector-33333333.*\.json:\/content/);expect(fetch.mock.calls[0][1].method).toBe('PUT')
})
it('OneDrive retention removes only old snapshots belonging to the current device after a successful write',async()=>{
 const fetch=vi.fn(async()=>new Response('{}'));vi.stubGlobal('fetch',fetch);const service=new OneDriveSync('token',Date.now()+60000,'33333333-3333-4333-8333-333333333333');service.ownFiles=[{id:'newer'},{id:'previous'},{id:'old-own-file'}];await service.write(empty());expect(fetch.mock.calls).toHaveLength(2);expect(String(fetch.mock.calls[1][0])).toContain('/me/drive/items/old-own-file');expect(fetch.mock.calls[1][1].method).toBe('DELETE')
})
it('bounds remote content while streaming even without a Content-Length header',async()=>{const response=new Response(new Uint8Array(10*1024*1024+1));await expect(readSyncJSON(response)).rejects.toThrow('10 MB')})
