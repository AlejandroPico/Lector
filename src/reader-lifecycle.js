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
