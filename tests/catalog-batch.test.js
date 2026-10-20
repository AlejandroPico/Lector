import {it,expect} from 'vitest'
import {planCatalogBatch,patchBatchRecord,batchValue} from '../src/catalog-batch-core.js'
const item=(id,extra={})=>({id,title:'Libro '+id,author:'Original',tags:['Base'],series:'Antigua',seriesIndex:4,collections:['c1'],...extra})
it('plans independent author, tags, series and collection changes without mutating source data',()=>{
 const items=[item('a'),item('b')],records=[{id:'a',status:'reading',overrides:{language:'es'}}],original=structuredClone({items,records})
 const plan=planCatalogBatch(items,records,{author:' Nueva autora ',tags:{mode:'add',values:['BASE','Nuevo','nuevo']},series:{name:'Saga',number:true,start:.5},collections:{mode:'add',values:['c2']}})
 expect(plan.entries).toHaveLength(2);expect(plan.entries[0].fields.find(f=>f.path==='overrides.tags').to).toEqual(['Base','Nuevo']);expect(plan.entries[1].fields.find(f=>f.path==='overrides.seriesIndex').to).toBe(1.5)
 expect(patchBatchRecord(records[0],plan.entries[0].fields)).toMatchObject({status:'reading',overrides:{language:'es',author:'Nueva autora',series:'Saga'},collections:['c1','c2']})
 expect({items,records}).toEqual(original)
})
it('removes and replaces labels deliberately, omits no-ops and clears a removed series number',()=>{
 expect(planCatalogBatch([item('a')],[],{author:'Original',tags:{mode:'remove',values:['ausente']}}).entries).toEqual([])
 const plan=planCatalogBatch([item('a')],[],{tags:{mode:'remove',values:['base']},series:{name:''},collections:{mode:'replace',values:[]}})
 expect(patchBatchRecord({id:'a'},plan.entries[0].fields)).toMatchObject({overrides:{tags:[],series:'',seriesIndex:null},collections:[]})
})
it('guards both identities of linked books and restores field absence without losing unrelated edits',()=>{
 const records=[{id:'cached',overrides:{tags:['Original']}},{id:'folder',status:'pending'}],plan=planCatalogBatch([item('folder',{savedId:'cached'})],records,{author:'Autora'})
 expect(plan.guards.map(g=>g.id)).toEqual(['folder','cached']);expect(plan.entries[0].fields[0].before).toEqual({exists:false})
 const updated=patchBatchRecord(records[1],plan.entries[0].fields);updated.status='finished';updated.overrides.language='ca'
 expect(patchBatchRecord(updated,plan.entries[0].fields,'before')).toEqual({id:'folder',status:'finished',overrides:{language:'ca'}})
 expect(batchValue({overrides:{author:undefined}},'overrides.author')).toEqual({exists:true,value:undefined})
})
it('rejects unsafe fields, duplicate selections, invalid modes and impossible numbering',()=>{
 expect(()=>patchBatchRecord({},[{path:'__proto__.x',after:{exists:true,value:1}}])).toThrow()
 expect(()=>planCatalogBatch([item('a'),item('a')],[],{author:'X'})).toThrow()
 expect(()=>planCatalogBatch([item('a')],[],{tags:{mode:'invalid',values:[]}})).toThrow()
 expect(()=>planCatalogBatch([item('a')],[],{series:{name:'',number:true,start:1}})).toThrow()
 expect(()=>planCatalogBatch([item('a')],[],{author:'x'.repeat(401)})).toThrow()
})
it('never silently drops tags when an addition exceeds the catalog limit',()=>{
 expect(()=>planCatalogBatch([item('a',{tags:Array.from({length:100},(_,i)=>'Etiqueta '+i)})],[],{tags:{mode:'add',values:['Otra']}})).toThrow('hasta 100')
})
it('plans five thousand books without reading files and captures each original field state',()=>{
 const plan=planCatalogBatch(Array.from({length:5000},(_,i)=>item(String(i))),[],{author:'Autora'})
 expect(plan.entries).toHaveLength(5000);expect(plan.guards).toHaveLength(5000);expect(plan.entries.every(entry=>entry.fields[0].before.exists===false)).toBe(true)
})
