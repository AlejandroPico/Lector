import {describe,it,expect,vi,afterEach} from 'vitest'
import {bridgeURL,mediaURL,safePresentation,cueAt,CastSender,DEFAULT_RECEIVER} from '../src/casting.js'
afterEach(()=>vi.unstubAllGlobals())
describe('explicit device emission',()=>{
 it('restricts administration to loopback and device media to reachable addresses',()=>{
  expect(bridgeURL('http://127.0.0.1:5056/')).toBe('http://127.0.0.1:5056')
  for(const value of ['https://example.com','http://127.0.0.1:5056/?password=x','http://u:p@localhost'])expect(()=>bridgeURL(value)).toThrow()
  expect(mediaURL('http://192.168.1.8:5056/media/audio')).toContain('192.168.1.8')
  for(const value of ['http://localhost/audio','blob:https://example.com/audio','javascript:alert(1)','http://u:p@192.168.1.8/audio'])expect(()=>mediaURL(value)).toThrow()
 })
 it('bounds metadata and ignores malformed cues, CSS and unapproved fields',()=>{
  const value=safePresentation({title:'a'.repeat(300),language:'xx',colors:['red','black','green'],cues:[{start:3,end:1,text:'bad'},{start:0,end:2,text:'Hola'}],apiKey:'secret',file:new Blob()})
  expect(value.title).toHaveLength(200);expect(value.language).toBe('es');expect(value.colors).toEqual(['#151a18','#e7e8dd','#a5b59a']);expect(value.cues).toHaveLength(1);expect(value.apiKey).toBeUndefined();expect(value.file).toBeUndefined()
 })
 it('switches passages at real audio segment boundaries',()=>{const cues=[{start:0,end:2,text:'First'},{start:2,end:3,text:'Second'}];expect(cueAt(cues,1.99)).toBe('First');expect(cueAt(cues,2)).toBe('Second');expect(cueAt(cues,3)).toBe('')})
 it('uses the official media request contract, metadata and remote controls',async()=>{
  const session={loadMedia:vi.fn(async()=>{})},context={setOptions:vi.fn(),requestSession:vi.fn(async()=>{}),getCurrentSession:()=>session,endCurrentSession:vi.fn()}
  class Player{isPaused=false}
  class Controller{constructor(player){this.player=player}playOrPause(){this.player.isPaused=!this.player.isPaused}seek(){}}
  vi.stubGlobal('cast',{framework:{CastContext:{getInstance:()=>context},RemotePlayer:Player,RemotePlayerController:Controller}})
  vi.stubGlobal('chrome',{cast:{AutoJoinPolicy:{ORIGIN_SCOPED:'origin'},media:{MediaInfo:class{constructor(url,type){this.contentId=url;this.contentType=type}},MusicTrackMediaMetadata:class{},LoadRequest:class{constructor(media){this.media=media}}}}})
  const sender=new CastSender();await sender.connect();expect(context.setOptions).toHaveBeenCalledWith(expect.objectContaining({receiverApplicationId:DEFAULT_RECEIVER}))
  await sender.load('http://192.168.1.8:5056/media/test','audio/wav',{title:'Book',author:'Author',chapter:'Chapter',cues:[]})
  const request=session.loadMedia.mock.calls[0][0];expect(request.autoplay).toBe(true);expect(request.media.metadata.title).toBe('Book');expect(request.media.customData.lector.chapter).toBe('Chapter')
  sender.pause();expect(sender.player.isPaused).toBe(true);sender.play();expect(sender.player.isPaused).toBe(false);sender.seek(45);expect(sender.player.currentTime).toBe(45);sender.disconnect();expect(context.endCurrentSession).toHaveBeenCalledWith(true)
 })
 it('requires an explicit valid receiver ID',async()=>{await expect(new CastSender().connect('bad-id')).rejects.toThrow('ocho')})
})
