import {it,expect,vi} from 'vitest'
import {guardRendererRender} from '../src/reader-lifecycle.js'

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
