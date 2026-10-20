import {it,expect,vi} from 'vitest'
import {createWebCast,createAndroidCast} from '../src/cast-sender.js'
it('an unregistered project never loads an SDK or requests a device',async()=>{
 const host={document:{createElement:vi.fn()}};const route=createWebCast({appId:'',host});expect(await route.initialize()).toBe(false);expect(host.document.createElement).not.toHaveBeenCalled();expect(route.available).toBe(false);expect(()=>route.request()).toThrow()
})
it('web Cast uses its registered ID, explicit selection and a receiver handshake before activation',async()=>{
 let state,receive;const send=vi.fn(async(_namespace,data)=>{if(data.type==='hello')receive('',{v:1,type:'ready',protocol:1})}),session={getCastDevice:()=>({friendlyName:'Sala'}),sendMessage:send,addMessageListener:(_ns,fn)=>receive=fn,removeMessageListener:()=>{}}
 const context={setOptions:vi.fn(),addEventListener:(_type,fn)=>state=fn,getCurrentSession:()=>session,requestSession:vi.fn(async()=>state({sessionState:'started'})),endCurrentSession:vi.fn()}
 const host={chrome:{cast:{AutoJoinPolicy:{PAGE_SCOPED:'page'}}},cast:{framework:{CastContext:{getInstance:()=>context},CastContextEventType:{SESSION_STATE_CHANGED:'state'},SessionState:{SESSION_STARTED:'started',SESSION_RESUMED:'resumed',SESSION_ENDED:'ended',SESSION_START_FAILED:'failed'}}}}
 const route=createWebCast({appId:'A1B2C3D4',host});await route.initialize();expect(context.setOptions).toHaveBeenCalledWith({receiverApplicationId:'A1B2C3D4',autoJoinPolicy:'page',resumeSavedSession:false});expect(route.active).toBe(false);expect(context.requestSession).not.toHaveBeenCalled();await route.request();await vi.waitFor(()=>expect(route.active).toBe(true));expect(route.device).toBe('Sala');route.disconnect();expect(route.active).toBe(false);expect(context.endCurrentSession).toHaveBeenCalledWith(true)
})
it('Android uses the native chooser and requires the same protocol; disconnect notifies playback',async()=>{
 const events={},plugin={addListener:async(type,fn)=>events[type]=fn,initialize:async()=>({available:true}),request:vi.fn(async()=>{}),send:vi.fn(async({message})=>{if(JSON.parse(message).type==='hello')events.message({v:1,type:'ready',protocol:1})}),disconnect:vi.fn(async()=>events.state({connected:false}))}
 const route=await createAndroidCast({plugin,appId:'A1B2C3D4'}),ended=vi.fn();route.onDisconnect(ended);expect(route.available).toBe(true);expect(route.active).toBe(false);await route.request();expect(plugin.request).toHaveBeenCalledOnce();await events.state({connected:true,device:'Altavoz'});expect(route.active).toBe(true);await route.disconnect();expect(route.active).toBe(false);expect(ended).toHaveBeenCalledOnce()
})
