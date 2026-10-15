import {it,expect} from 'vitest'
import {annotationLanes,annotationsOverlap,drawNoteMarks} from '../src/note-marks.js'
import {safeSync} from '../src/sync-core.js'
const note=(id,start,end,color='gold')=>({id,kind:'note',cfi:`epubcfi(/6/2!/4/2,/1:${start},/1:${end})`,color,style:'highlight',updatedAt:1})
it('nested and identical ranges get separate lanes, disjoint ranges reuse them',()=>{
 const notes=[note('outer',0,30),note('inside',5,10),note('same',5,10),note('after',35,45)]
 const lanes=annotationLanes(notes);expect(new Set(notes.slice(0,3).map(n=>lanes.get(n.id))).size).toBe(3);expect(lanes.get('after')).toBe(0)
 expect(annotationsOverlap(notes[0],notes[1])).toBe(true);expect(annotationsOverlap(notes[1],notes[3])).toBe(false)
 const svg=drawNoteMarks([{left:0,top:0,width:70,height:20,bottom:20}],{notes:notes.slice(1,3),lanes});expect(svg.querySelectorAll('[data-note-id]')).toHaveLength(2);expect(new Set([...svg.querySelectorAll('g>rect:last-child')].map(r=>r.getAttribute('y'))).size).toBe(2)
})
it('sync retains new annotation colours and independent notes at the same anchor',()=>{
 const notes=[note('one',0,10,'lavender'),note('two',0,10,'mint')],value=safeSync({format:'lector-sync',version:1,books:[{id:'a'.repeat(64),notes}]})
 expect(value.books[0].notes.map(n=>n.color)).toEqual(['lavender','mint']);expect(value.books[0].notes).toHaveLength(2)
})
