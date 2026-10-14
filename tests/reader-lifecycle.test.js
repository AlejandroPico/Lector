import {it,expect,vi} from 'vitest'
import {guardRendererRender,serializeRendererNavigation} from '../src/reader-lifecycle.js'

it('defers resize layout while a chapter document loads, then renders normally',()=>{
  const render=vi.fn(),renderer={getContents:()=>[{doc:document.implementation.createHTMLDocument()}]}
  class Renderer {}
  Renderer.prototype.render=render;guardRendererRender(Renderer)
  Renderer.prototype.render.call(renderer)
  expect(render).not.toHaveBeenCalled()
  renderer.getContents=()=>[{doc:document}]
  Renderer.prototype.render.call(renderer,'layout')
  expect(render).toHaveBeenCalledWith('layout')
})
it('a chapter request waits for an animated page turn and a rejected request does not block later navigation',async()=>{
 let finish;const events=[]
 class Renderer {async next(){events.push('turn');await new Promise(resolve=>finish=resolve);events.push('turned')}async goTo(index){events.push(index);if(index===9)throw new Error('bad chapter')}}
 serializeRendererNavigation(Renderer);const renderer=new Renderer(),turn=renderer.next(),chapter=renderer.goTo(2)
 await Promise.resolve();await Promise.resolve();expect(events).toEqual(['turn']);finish();await Promise.all([turn,chapter]);expect(events).toEqual(['turn','turned',2]);await expect(renderer.goTo(9)).rejects.toThrow('bad chapter');await renderer.goTo(3);expect(events.at(-1)).toBe(3)
})
