import {it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {cameraGeometry,cameraPanFor} from '../src/book-camera-core.js'
import {adaptCameraPaginator,adaptCameraFixedLayout} from '../foliate-camera.js'
import {safeSettings} from '../src/storage.js'
import {portablePreferences} from '../src/sync-core.js'
const box={left:20,top:150,width:350,height:460},viewport={left:14,top:75,right:376,bottom:700}
it('keeps the original camera at 100 percent and bounds magnified framing to the book edges',()=>{
 const original=cameraGeometry(box,viewport,100,100,-100);expect([original.scale,original.tx,original.ty]).toEqual([1,0,0])
 for(const x of [-100,0,100])for(const y of [-100,0,100]){const g=cameraGeometry(box,viewport,200,x,y),left=box.left-box.width/2+g.tx,top=box.top-box.height/2+g.ty;expect(left).toBeLessThanOrEqual(viewport.left);expect(left+box.width*2).toBeGreaterThanOrEqual(viewport.right);expect(top).toBeLessThanOrEqual(viewport.top);expect(top+box.height*2).toBeGreaterThanOrEqual(viewport.bottom)}
})
it('keeps a smaller zoomed book entirely in the visible frame and constrains gesture requests',()=>{
 const small={left:90,top:570,width:120,height:100},g=cameraGeometry(small,viewport,120)
 expect(small.top+(small.height-small.height*g.scale)/2+g.ty+small.height*g.scale).toBeLessThanOrEqual(viewport.bottom)
 const large=cameraGeometry(box,viewport,200,45,-30);expect(cameraPanFor(large,large.tx,large.ty)).toEqual({x:45,y:-30});expect(cameraPanFor(large,1e6,-1e6)).toEqual({x:100,y:-100})
})
it('validates recovered camera settings and synchronizes only its explicit portable values',()=>{
 const value=safeSettings({bookCameraZoom:Infinity,bookCameraX:1e5,bookCameraY:-1e5});expect([value.bookCameraZoom,value.bookCameraX,value.bookCameraY]).toEqual([100,100,-100]);expect(safeSettings({bookCameraZoom:999}).bookCameraZoom).toBe(200)
 expect(portablePreferences({bookCameraZoom:160,bookCameraX:20,bookCameraY:-30,cameraEditing:true,privatePhoto:'x'})).toEqual({bookCameraZoom:160,bookCameraX:20,bookCameraY:-30})
})
it('adapts exactly the pinned host measurements, leaving document geometry intact and failing on an unknown library',()=>{
 const paginator=readFileSync('node_modules/foliate-js/paginator.js','utf8'),fixed=readFileSync('node_modules/foliate-js/fixed-layout.js','utf8')
 const changed=adaptCameraPaginator(paginator);expect(changed.match(/lectorCameraLayoutRect\(this\./g)).toHaveLength(3);expect(changed).toContain('this.#contentRange.getBoundingClientRect()');expect(adaptCameraFixedLayout(fixed)).toContain('lectorCameraLayoutRect(this)')
 expect(()=>adaptCameraPaginator('changed library')).toThrow();expect(()=>adaptCameraFixedLayout('changed library')).toThrow()
})
