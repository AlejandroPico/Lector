export class NavigationTrail {
  constructor(saved={}) { this.past=(saved.past??[]).filter(x=>typeof x==='string').slice(-50);this.future=(saved.future??[]).filter(x=>typeof x==='string').slice(-50) }
  visit(origin,destination) {if(!origin || origin===destination)return; if(this.past.at(-1)!==origin)this.past.push(origin);this.past=this.past.slice(-50);this.future=[]}
  back(current) {const target=this.past.pop();if(target && current)this.future.push(current);return target}
  forward(current) {const target=this.future.pop();if(target && current)this.past.push(current);return target}
  snapshot() {return {past:[...this.past],future:[...this.future]}}
}
export function countWords(text,language='es') {return [...new Intl.Segmenter(language,{granularity:'word'}).segment(text)].filter(word=>word.isWordLike).length}
export function readingMetrics(doc,language) {
  const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT,{acceptNode:node=>node.parentElement?.closest('[hidden],script,style,button,nav,[data-no-speech],rt,rp')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT})
  const nodes=new Map();let total=0
  for(let node=walker.nextNode();node;node=walker.nextNode()){nodes.set(node,total);total+=countWords(node.textContent,language)}
  const blocks=[...doc.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote')]
  return {total,position(range){
    if(!range)return {words:0,block:1,offset:0}
    const node=range.startContainer,element=node.nodeType===Node.TEXT_NODE?node.parentElement:node
    const block=element.closest('h1,h2,h3,h4,h5,h6,p,li,blockquote')??doc.body
    const prefix=doc.createRange();prefix.selectNodeContents(block);prefix.setEnd(node,range.startOffset)
    const words=(nodes.get(node)??0)+countWords(node.textContent?.slice(0,range.startOffset)??'',language)
    return {words,block:Math.max(1,blocks.indexOf(block)+1),offset:prefix.toString().length}
  }}
}
export function estimateRemaining(sections,stats,index,readWords,wpm,chapterEnd=index+1) {
  const known=Object.entries(stats).filter(([i,data])=>data.words>0 && sections[i]?.size>0)
  const ratio=known.length?known.reduce((sum,[,data])=>sum+data.words,0)/known.reduce((sum,[i])=>sum+sections[i].size,0):0
  const words=sections.map((section,i)=>section.linear==='no'?0:stats[i]?.words??Math.max(0,section.size??0)*ratio)
  const section=Math.max(0,(words[index]??0)-readWords)
  const chapter=section+words.slice(index+1,chapterEnd).reduce((sum,value)=>sum+value,0)
  const unknown=!known.length&&sections.some((section,i)=>i>index&&section.linear!=='no'&&!stats[i])
  return {chapter:chapter/Math.max(1,wpm),book:unknown?null:(section+words.slice(index+1).reduce((sum,value)=>sum+value,0))/Math.max(1,wpm)}
}

// Follow spoken positions, never a free-running scrolling speed. Voices with
// no word events use an explicitly approximate progress within each fragment.
export class ContinuousFollower {
  constructor(view,settings) {this.view=view;this.settings=settings;this.playing=false;this.frame=0}
  setState(state){this.playing=state==='playing';this.last=performance.now();if(this.playing && this.segment)this.schedule()}
  begin(segment,rate,media=false){this.stop();this.segment=segment;this.media=media;this.elapsed=0;this.last=performance.now();this.marked=false;this.duration=Math.max(350,countWords(segment.text,this.settings().language)/(this.settings().narrationWpm??170)*60000/rate);this.playing=true;this.target=null;this.schedule()}
  stop(){cancelAnimationFrame(this.frame);this.frame=0;this.segment=null;this.target=null}
  word(range){this.marked=true;this.setTarget(range);if(this.playing)this.schedule()}
  progress(fraction){if(this.segment && !this.marked)this.setTarget(this.segment.wordRange?.(Math.min(this.segment.text.length-1,Math.floor(this.segment.text.length*fraction)),1)??this.segment.range)}
  setTarget(range){
    const renderer=this.view.renderer
    if(!renderer?.scrolled || renderer.scrollProp!=='scrollTop' || !range)return
    const rect=[...range.getClientRects()].find(rect=>rect.width>0&&rect.height>0)
    if(!rect)return
    const body=range.startContainer.ownerDocument.body.getBoundingClientRect()
    const along=Math.max(0,Math.min(1,(rect.left-body.left)/Math.max(1,body.width)))
    this.target=Math.max(0,Math.min(renderer.viewSize-renderer.size,rect.top+rect.height*along-renderer.size*.35))
  }
  schedule(){if(!this.frame)this.frame=requestAnimationFrame(time=>this.tick(time))}
  tick(time){
    this.frame=0
    const renderer=this.view.renderer
    if(!this.segment || !renderer?.scrolled || !this.settings().followSpeech){this.stop();return}
    const delta=Math.min(100,time-this.last);this.last=time
    if(this.playing){
      this.elapsed+=delta
      if(!this.marked&&!this.media)this.progress(Math.min(.98,this.elapsed/this.duration))
      if(this.target!==null){const distance=this.target-renderer.containerPosition;renderer.containerPosition+=matchMedia('(prefers-reduced-motion: reduce)').matches?distance:distance*(1-Math.exp(-delta/130))}
      this.schedule()
    }
  }
}
