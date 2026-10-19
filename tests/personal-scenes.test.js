import {it,expect} from 'vitest'
import {isPersonalScene,sceneImageSize,prepareScenePhoto} from '../src/personal-scene-core.js'
import {safeSettings} from '../src/storage.js'
import {portablePreferences} from '../src/sync-core.js'
const id='photo-12345678-abcd-1234-abcd-123456789abc'
it('accepts only opaque personal resource identities and keeps photos out of portable preferences',()=>{
  expect(isPersonalScene(id)).toBe(true);expect(safeSettings({bookScene:id}).bookScene).toBe(id)
  for(const value of ['photo-../../x','data:image/png,x','https://private/photo'])expect(safeSettings({bookScene:value}).bookScene).toBe('auto')
  expect(portablePreferences({bookScene:id,image:'private bytes',name:'private title'})).toEqual({bookScene:'auto'})
})
it('bounds decoded photo dimensions without stretching or enlarging small photos',()=>{
  expect(sceneImageSize(5120,2560)).toEqual({width:2560,height:1280});expect(sceneImageSize(1280,2560)).toEqual({width:1280,height:2560})
  expect(sceneImageSize(200,100)).toEqual({width:200,height:100})
  for(const pair of [[0,2],[10000,10000],[NaN,1]])expect(()=>sceneImageSize(...pair)).toThrow()
})
it('rejects oversized resources and SVG references before decoding or fetching',async()=>{
  await expect(prepareScenePhoto({size:21*1024*1024})).rejects.toThrow('20 MB')
  await expect(prepareScenePhoto({size:10,slice:()=>({arrayBuffer:async()=>new TextEncoder().encode('<svg href="https://tracker.invalid">').buffer})})).rejects.toThrow('PNG')
})
