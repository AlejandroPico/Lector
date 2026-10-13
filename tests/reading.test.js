import {it,expect} from 'vitest'
import {NavigationTrail,readingMetrics,estimateRemaining} from '../src/reading.js'
import {gamepadKeys} from '../src/tv-controls.js'
it('navigation returns to exact anchors, branches and bounds history',()=>{
  const trail=new NavigationTrail();trail.visit('A','B');expect(trail.back('B')).toBe('A');expect(trail.forward('A')).toBe('B')
  trail.back('B');trail.visit('A','C');expect(trail.future).toEqual([])
  for(let i=0;i<100;i++)trail.visit(String(i),String(i+1));expect(new NavigationTrail(trail.snapshot()).past).toHaveLength(50)
})
it('time estimates exclude non-reading sections and scale with pace',()=>{
  const sections=[{size:100},{size:200},{size:400,linear:'no'}],stats={0:{words:100}}
  expect(estimateRemaining(sections,stats,0,50,100)).toEqual({chapter:.5,book:2.5})
  expect(estimateRemaining(sections,stats,0,50,200)).toEqual({chapter:.25,book:1.25})
  expect(estimateRemaining(sections,{0:{words:0}},0,0,100).book).toBeNull()
})
it('reading metrics ignore hidden text and identify a stable text offset',()=>{
  const doc=new DOMParser().parseFromString('<p>uno dos <span hidden>no leer</span>tres</p><p>cuatro cinco</p>','text/html')
  const node=doc.querySelectorAll('p')[1].firstChild,range=doc.createRange();range.setStart(node,7);range.collapse(true)
  const metric=readingMetrics(doc,'es');expect(metric.total).toBe(5);expect(metric.position(range)).toEqual({words:4,block:2,offset:7})
})
it('remote gamepad inputs map to reading and selection controls',()=>{
  const buttons=Array.from({length:16},()=>({pressed:false}));buttons[0].pressed=true;buttons[14].pressed=true
  expect(gamepadKeys({buttons,axes:[0,1]})).toEqual(['Enter','ArrowLeft','ArrowDown'])
})
