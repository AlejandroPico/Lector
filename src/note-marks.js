import {compare,collapse} from 'foliate-js/epubcfi.js'
import {annotationColor} from './notes.js'
export const annotationsOverlap=(a,b)=>compare(collapse(a.cfi),collapse(b.cfi,true))<0&&compare(collapse(b.cfi),collapse(a.cfi,true))<0

// Interval colouring keeps intersecting annotations in distinct underline lanes.
export function annotationLanes(notes){
  const lanes=new Map(),ends=[]
  for(const note of notes.filter(note=>note.kind!=='bookmark').slice().sort((a,b)=>compare(collapse(a.cfi),collapse(b.cfi)))){
    const start=collapse(note.cfi);let lane=ends.findIndex(end=>compare(end,start)<=0)
    if(lane<0)lane=ends.length
    ends[lane]=collapse(note.cfi,true);lanes.set(note.id,lane)
  }
  return lanes
}
export function drawNoteMarks(rects,{notes,lanes}){
  const group=document.createElementNS('http://www.w3.org/2000/svg','g')
  for(const note of notes){
    const color=annotationColor(note),lane=lanes.get(note.id)??0,mark=document.createElementNS(group.namespaceURI,'g');mark.setAttribute('fill',color);mark.dataset.noteId=note.id
    for(const rect of rects){
      if(note.style==='highlight'){const fill=document.createElementNS(group.namespaceURI,'rect');for(const [key,value] of Object.entries({x:rect.left,y:rect.top,width:rect.width,height:rect.height,opacity:.16}))fill.setAttribute(key,value);mark.append(fill)}
      const line=document.createElementNS(group.namespaceURI,'rect');for(const [key,value] of Object.entries({x:rect.left,y:rect.bottom+lane*3,width:rect.width,height:2}))line.setAttribute(key,value);mark.append(line)
    }
    group.append(mark)
  }
  return group
}
