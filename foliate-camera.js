// Foliate measures three host rectangles for pagination. CSS camera transforms
// must affect only their display, never the logical column or scroll sizes.
export function adaptCameraPaginator(source){
  const targets=['this.#container.getBoundingClientRect()','this.#view.element.getBoundingClientRect()']
  let count=0
  for(const target of targets)source=source.replaceAll(target,()=>{count++;return `lectorCameraLayoutRect(${target.split('.getBoundingClientRect')[0]})`})
  if(count!==3)throw Error('La adaptación de cámara requiere revisar la versión de foliate-js.')
  return cameraRectHelper+source
}
const cameraRectHelper=`const lectorCameraLayoutRect=element=>{const rect=element.getBoundingClientRect(),host=element.getRootNode().host??element,outer=host.getRootNode().host??host,scale=Number(outer.closest?.('#reading-area')?.dataset.cameraScale)||1;return {width:rect.width/scale,height:rect.height/scale}};\n`
export function adaptCameraFixedLayout(source){if(source.split('this.getBoundingClientRect()').length!==2)throw Error('Revisar cámara de foliate-js fixed-layout.');return cameraRectHelper+source.replace('this.getBoundingClientRect()','lectorCameraLayoutRect(this)')}
export function foliateCamera(){return {name:'lector-camera-layout',enforce:'pre',transform(source,id){const path=id.replaceAll('\\','/').split('?')[0];if(path.endsWith('/foliate-js/paginator.js'))return {code:adaptCameraPaginator(source),map:null};if(path.endsWith('/foliate-js/fixed-layout.js'))return {code:adaptCameraFixedLayout(source),map:null}}}}
