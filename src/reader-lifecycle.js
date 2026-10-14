import {Paginator} from 'foliate-js/paginator.js'

// Foliate 1.0.1 can receive a resize notification between creating a chapter
// iframe and loading its document. Its render() assumes an HTML root exists.
// The normal load callback performs the layout once the document is ready.
export function guardRendererRender(Renderer) {
  const original=Renderer.prototype.render
  Renderer.prototype.render=function(...args) {
    const doc=this.getContents()[0]?.doc
    if(!doc?.documentElement||!doc.body||!doc.defaultView)return
    return original.apply(this,args)
  }
}
guardRendererRender(Paginator)

// The paginator changes its index before the new iframe finishes loading.
// Serialize navigation so word events and UI commands cannot cross documents
// or disappear while the native page animation holds its lock.
export function serializeRendererNavigation(Renderer) {
  const queues=new WeakMap()
  for(const method of ['goTo','next','prev']) {
    const original=Renderer.prototype[method]
    if(!original)continue
    Renderer.prototype[method]=function(...args){
      const task=(queues.get(this)??Promise.resolve()).catch(()=>{}).then(()=>original.apply(this,args))
      queues.set(this,task)
      return task
    }
  }
}
serializeRendererNavigation(Paginator)
