import {test,expect} from 'vitest'
import {pdfLines,orderedPDFLines,repeatedMargins} from '../src/pdf-layout.js'
const line=(text,x,y,right)=>({text,x,y,right,size:12})
test('columns are read down before moving across, with spanning headings preserved',()=>{
 const lines=[line('Título',40,40,550),...Array.from({length:4},(_,i)=>line(`L${i}`,50,100+i*22,270)),...Array.from({length:4},(_,i)=>line(`R${i}`,340,100+i*22,550))]
 expect(orderedPDFLines({lines,height:800}).map(x=>x.text)).toEqual(['Título','L0','L1','L2','L3','R0','R1','R2','R3'])
})
test('repeated margin removal is optional and preserves similar body text',()=>{
 const pages=[1,2,3].map(n=>({height:800,lines:[line('Cabecera',10,30,100),line('Cabecera',10,300,100),line(`Página ${n}`,10,780,100)]})),repeated=repeatedMargins(pages)
 expect(orderedPDFLines(pages[0],{order:'1',hideMargins:true},repeated).map(x=>x.text)).toEqual(['Cabecera'])
 expect(orderedPDFLines(pages[0],{order:'1'},repeated)).toHaveLength(3)
})
test('geometric lines preserve inline fragments and separate columns',()=>{
 const item=(str,x,width)=>({str,width,transform:[12,0,0,12,x,700]})
 expect(pdfLines([item('Hola',50,25),item('mundo',80,40),item('Derecha',340,70)],800).map(x=>x.text)).toEqual(['Hola mundo','Derecha'])
})
