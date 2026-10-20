import {it,expect,vi,afterEach} from 'vitest'
import {webcrypto} from 'node:crypto'
import {Blob as NodeBlob} from 'node:buffer'
import {AudioReceiver,bytes64,digest,CHUNK_BYTES,MAX_AUDIO_BYTES,castMetadata,validAppId} from '../src/cast-protocol.js'
import {CastAudio} from '../src/cast-output.js'
vi.stubGlobal('crypto',webcrypto)
vi.stubGlobal('Blob',NodeBlob)
const clean=[];afterEach(()=>{for(const close of clean.splice(0))close()})
function receiver(){const send=vi.fn(),play=vi.fn(),control=vi.fn(),r=new AudioReceiver({send,play,control});clean.push(()=>r.release('owner'));return {r,send,play,control}}
const begin=(size=4,id='clip')=>({v:1,type:'begin',id,size,mime:'audio/wav',rate:1,metadata:{title:'Mi libro',apiKey:'secret'}})
const part=(bytes,id='clip',index=0)=>({v:1,type:'chunk',id,part:index,data:bytes64(bytes)})
it('accepts ordered bounded audio, verifies its digest and forwards only metadata whitelist',async()=>{
 const {r,send,play}=receiver(),bytes=new Uint8Array(CHUNK_BYTES+7).fill(53);await r.receive('owner',begin(bytes.length));await r.receive('owner',part(bytes.subarray(0,CHUNK_BYTES)));await r.receive('owner',part(bytes.subarray(CHUNK_BYTES),'clip',1));await r.receive('owner',{v:1,type:'commit',id:'clip',digest:await digest(bytes)});expect(play).toHaveBeenCalledOnce();expect(play.mock.calls[0][0].size).toBe(bytes.length);expect(play.mock.calls[0][2].apiKey).toBeUndefined();expect(send.mock.calls.at(-1)[1]).toMatchObject({type:'ack',part:-2})
})
it('rejects reordered, truncated and corrupted fragments before playback',async()=>{
 for(const variant of ['reordered','truncated','corrupted']){const {r,play,send}=receiver();await r.receive('owner',begin());await r.receive('owner',part(new Uint8Array(variant==='truncated'?3:4),'clip',variant==='reordered'?1:0));await r.receive('owner',{v:1,type:'commit',id:'clip',digest:'a'.repeat(64)});expect(play).not.toHaveBeenCalled();expect(send.mock.calls.some(([,m])=>m.type==='error')).toBe(true)}
})
it('refuses another sender, overlapping transfers, invalid audio and excessive allocation',async()=>{
 const {r,play,send}=receiver();await r.receive('owner',begin());await r.receive('intruder',part(new Uint8Array(4)));await r.receive('intruder',{v:1,type:'stop',id:'clip'});expect(r.pending.received).toBe(0);await r.receive('owner',begin(4,'other'));expect(r.pending.id).toBe('clip');r.release('owner');await r.receive('owner',begin(MAX_AUDIO_BYTES+1));await r.receive('owner',{...begin(),mime:'text/html'});expect(r.pending).toBeNull();expect(play).not.toHaveBeenCalled();expect(send.mock.calls.filter(([,m])=>m.type==='error')).toHaveLength(5)
})
it('stops and clears state on owner disconnect without trusting other senders',async()=>{
 const {r,control}=receiver();await r.receive('owner',begin());r.release('intruder');expect(r.pending).not.toBeNull();r.release('owner');expect(r.pending).toBeNull();expect(r.owner).toBeNull();expect(control).toHaveBeenCalledWith('stop')
})
it('keeps protocol, IDs and metadata inert, bounded and free of external URLs',()=>{
 expect(validAppId('')).toBe(false);expect(validAppId('CC1AD845')).toBe(false);expect(validAppId('A1B2C3D4')).toBe(true);const m=castMetadata({title:'x'.repeat(1000),cover:'https://tracker.test/a.jpg',text:'<script>inert</script>',key:'secret'});expect(m.title).toHaveLength(400);expect(m.cover).toBe('');expect(m.text).toBe('<script>inert</script>');expect(m.key).toBeUndefined()
})
function loop(){const listeners=new Set(),disconnections=new Set(),commands=[];let receiverState
 const route={subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn)},onDisconnect(fn){disconnections.add(fn);return ()=>disconnections.delete(fn)},send:async m=>{commands.push(m);await r.receive('owner',m)}}
 const r=new AudioReceiver({send:(_sender,m)=>{for(const listener of listeners)listener(m)},play:async()=>{receiverState='playing';r.status({state:'playing',time:0,duration:30})},control:type=>{if(type==='play'||type==='pause'){receiverState=type==='play'?'playing':'paused';r.status({state:receiverState,time:2,duration:30})}}});const audio=new CastAudio(route,new Blob([new Uint8Array(4)],{type:'audio/wav'}),{title:'Título'});clean.push(()=>{audio.dispose();r.release('owner')});return {audio,r,commands,disconnect:()=>{for(const fn of disconnections)fn()},get state(){return receiverState}}}
it('remote audio transfers once and routes pause, resume and seek to the same output',async()=>{
 const l=loop(),playing=vi.fn();l.audio.onplaying=playing;await l.audio.play();expect(l.audio.duration).toBe(30);expect(playing).toHaveBeenCalledOnce();l.audio.pause();await Promise.resolve();expect(l.state).toBe('paused');await l.audio.play();expect(l.state).toBe('playing');l.audio.currentTime=12;expect(l.commands.at(-1)).toMatchObject({type:'seek',time:12});expect(l.commands.filter(m=>m.type==='begin')).toHaveLength(1);l.audio.dispose();expect(l.commands.at(-1).type).toBe('stop')
})
it('disconnect and disposal reject outstanding transfers, without a local player fallback',async()=>{
 const l=loop(),error=vi.fn();l.audio.onerror=error;await l.audio.play();l.disconnect();expect(error).toHaveBeenCalledOnce();expect(l.audio.live).toBe(false);await expect(l.audio.play()).rejects.toThrow('emisión')
 const listeners=new Set(),audio=new CastAudio({subscribe:fn=>{listeners.add(fn);return ()=>listeners.delete(fn)},onDisconnect:()=>()=>{},send:async()=>{}},new Blob([new Uint8Array(4)],{type:'audio/wav'}),{});const pending=audio.play();pending.catch(()=>{});await vi.waitFor(()=>expect(audio.waiters.size).toBe(1));audio.dispose();await expect(pending).rejects.toThrow();expect(listeners.size).toBe(0)
})
it('expired transfers are rejected without creating a player',async()=>{
 let now=0;const {r,play}=receiver();r.now=()=>now;await r.receive('owner',begin());now=120001;await r.receive('owner',part(new Uint8Array(4)));expect(r.pending).toBeNull();expect(play).not.toHaveBeenCalled()
})
