import {it,expect,vi} from 'vitest'
import {nativeSpeechAdapter} from '../src/native-speech.js'
import {reviveNativeHandles,setDirectoryTransport,chooseNativeFolder} from '../src/native-directory.js'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{assetPath,bookPath}=require('../desktop/paths.cjs')
function engine(){let event;const api={addListener:async(_name,callback)=>{event=callback;return {remove(){}}},voices:async()=>({voices:[{voiceURI:'local',name:'Español',lang:'es-ES'}]}),speak:vi.fn(async()=>{}),cancel:vi.fn(async()=>{}),pause:vi.fn(async()=>{}),resume:vi.fn(async()=>{})};return {api,emit:data=>event(data)}}
it('native speech maps real engine ranges and discards callbacks after cancel',async()=>{const host=engine(),adapter=await nativeSpeechAdapter(host.api),utterance=new adapter.Utterance('Texto de prueba'),boundary=vi.fn(),end=vi.fn();utterance.onboundary=boundary;utterance.onend=end;adapter.synthesis.speak(utterance);const id=host.api.speak.mock.calls[0][0].id;host.emit({id,type:'boundary',charIndex:6,charLength:2});expect(boundary.mock.calls[0][0].charIndex).toBe(6);adapter.synthesis.pause();expect(host.api.pause).toHaveBeenCalledOnce();adapter.synthesis.resume();expect(host.api.resume).toHaveBeenCalledOnce();adapter.synthesis.cancel();host.emit({id,type:'end'});expect(end).not.toHaveBeenCalled();expect(adapter.synthesis.speaking).toBe(false)})
it('native queued fragments retain the explicit paused state',async()=>{const host=engine(),adapter=await nativeSpeechAdapter(host.api);adapter.synthesis.speak(new adapter.Utterance('Uno'));adapter.synthesis.pause();adapter.synthesis.speak(new adapter.Utterance('Dos'));expect(host.api.speak.mock.calls[1][0].paused).toBe(true);expect(adapter.synthesis.paused).toBe(true);adapter.synthesis.cancel()})
it('hands the complete queue to the device and resynchronizes after suspended JavaScript',async()=>{
 const host=engine();Object.assign(host.api,{startQueue:vi.fn(async()=>{}),rewind:vi.fn(async()=>{}),status:vi.fn()})
 const adapter=await nativeSpeechAdapter(host.api,{queue:true}),onPosition=vi.fn(),onState=vi.fn(),onStop=vi.fn()
 const playback=adapter.synthesis.startQueue({items:[{text:'Primero'},{text:'Segundo'}],bookId:'book'},{onPosition,onState,onStop})
 const id=host.api.startQueue.mock.calls[0][0].id
 expect(host.api.startQueue).toHaveBeenCalledOnce();expect(host.api.speak).not.toHaveBeenCalled()
 host.emit({id,type:'boundary',item:1,charIndex:3,state:'playing'});expect(onPosition).toHaveBeenLastCalledWith(expect.objectContaining({item:1,charIndex:3}))
 host.api.status.mockResolvedValue({id,state:'paused',item:1,charIndex:5});await adapter.synthesis.sync();expect(adapter.synthesis.paused).toBe(true);expect(onState).toHaveBeenLastCalledWith('paused')
 await adapter.synthesis.rewind();await adapter.synthesis.rewind();expect(host.api.rewind).toHaveBeenCalledTimes(2)
 host.api.status.mockResolvedValue({id,state:'stopped',reason:'sleep'});await adapter.synthesis.sync();await playback;expect(onStop).toHaveBeenCalledWith(expect.objectContaining({reason:'sleep'}));expect(adapter.synthesis.speaking).toBe(false)
})
it('reports native failures after suspension and ignores callbacks from cancelled queues',async()=>{
 const host=engine();Object.assign(host.api,{startQueue:vi.fn(async()=>{}),status:vi.fn()});const adapter=await nativeSpeechAdapter(host.api,{queue:true}),position=vi.fn()
 const first=adapter.synthesis.startQueue({items:[{text:'Texto'}]},{onPosition:position}),id=host.api.startQueue.mock.calls[0][0].id
 adapter.synthesis.cancel();await first;host.emit({id,type:'boundary',item:0,charIndex:8});expect(position).not.toHaveBeenCalled()
 const second=adapter.synthesis.startQueue({items:[{text:'Texto'}]});host.api.status.mockResolvedValue({state:'stopped',error:'synthesis-failed'});const rejection=expect(second).rejects.toThrow('synthesis-failed');await adapter.synthesis.sync();await rejection
})
it('native folders remain serializable and never read book bytes while listing',async()=>{let reads=0;setDirectoryTransport({chooseFolder:async()=>({rootId:'chosen',name:'Libros',parts:[],kind:'directory'}),permission:async()=>({state:'granted'}),listDirectory:async()=>({entries:[{name:'libro.txt',kind:'file'}]}),readFile:async()=>{reads++;return {name:'libro.txt',bytes:new Uint8Array([1,2,3])}}});const folder=await chooseNativeFolder(),restored=reviveNativeHandles(JSON.parse(JSON.stringify(folder)));const entries=[];for await(const entry of restored.values())entries.push(entry);expect(reads).toBe(0);expect(await restored.queryPermission()).toBe('granted');expect((await entries[0].getFile()).size).toBe(3);expect(reads).toBe(1)})
it('cancelling a native folder picker does not grant a broken handle',async()=>{setDirectoryTransport({chooseFolder:async()=>({cancelled:true})});await expect(chooseNativeFolder()).rejects.toMatchObject({name:'AbortError'});setDirectoryTransport(null)})
it('desktop asset and file launch routes cannot escape the bundle',()=>{expect(assetPath('/app/dist','lector://app/index.html')).toMatch(/dist[\\/]index.html$/);expect(assetPath('/app/dist','lector://app/%2f..%2f..%2fprivate')).toBeNull();expect(assetPath('/app/dist','lector://other/index.html')).toBeNull();expect(assetPath('/app/dist','lector://app/%00')).toBeNull();expect(bookPath('relative.epub')).toBe(false)})
