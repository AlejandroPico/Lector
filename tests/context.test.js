import {it,expect,vi} from 'vitest'
import {selectedContext,alignedParagraphs,readableParagraphs,requestContext,contextEndpoint} from '../src/context-core.js'

it('extracts the sentence around a selected word, without sending the rest of the book',()=>{
  const doc=new DOMParser().parseFromString('<p>Primera frase privada. El sosiego llegó por fin. Otra frase privada.</p><p>Otro capítulo secreto.</p>','text/html')
  const node=doc.querySelector('p').firstChild,index=node.textContent.indexOf('sosiego'),range=doc.createRange();range.setStart(node,index);range.setEnd(node,index+7)
  expect(selectedContext({quote:'sosiego',range},'es')).toEqual({word:'sosiego',text:'El sosiego llegó por fin.',language:'es'})
})
it('bounds very long context while retaining the word at its selected position',()=>{
  const doc=new DOMParser().parseFromString(`<p>${'antes '.repeat(1000)}palabra ${'después '.repeat(1000)}</p>`,'text/html'),node=doc.querySelector('p').firstChild,index=node.textContent.indexOf('palabra'),range=doc.createRange()
  range.setStart(node,index);range.setEnd(node,index+7)
  const result=selectedContext({quote:'palabra',range},'es')
  expect(result.text.length).toBeLessThanOrEqual(3000);expect(result.text).toContain('palabra')
})
it('aligns paragraphs using offsets and manual anchors without dropping unpaired text',()=>{
  const rows=alignedParagraphs(['a','b','c'],['preface','A','B','C','extra'],{offset:1,pairs:{1:3}})
  expect(rows.slice(0,3).map(row=>row.target)).toEqual(['A','C','extra'])
  expect(rows.slice(3).map(row=>row.target)).toEqual(['preface','B'])
  expect(alignedParagraphs(['a','b'],['A','B'],{pairs:{0:null}})[0].target).toBeNull()
})
it('extracts nested paragraph text once and excludes navigation and hidden content',()=>{
  const doc=new DOMParser().parseFromString('<h1>Título</h1><blockquote><p>Una cita.</p></blockquote><nav><p>Índice</p></nav><p hidden>Oculto</p>','text/html')
  expect(readableParagraphs(doc).map(row=>row.text)).toEqual(['Título','Una cita.'])
})
it('validates local-only engines, encrypted external addresses and destinations without secrets',()=>{
  expect(contextEndpoint('http://127.0.0.1:11434/api/chat',true)).toContain('127.0.0.1')
  for(const url of ['http://remote.example/api','https://remote.example/api?key=secret','https://user:secret@remote.example/api','javascript:alert(1)'])expect(()=>contextEndpoint(url)).toThrow()
  expect(()=>contextEndpoint('https://remote.example/api',true)).toThrow()
})
it('preserves line breaks and text before and after a nested block, including speech offsets',()=>{
  const doc=new DOMParser().parseFromString('<blockquote>Antes<p>Primera línea<br>Segunda <em>palabra</em>.</p>Después</blockquote>','text/html')
  const paragraphs=readableParagraphs(doc)
  expect(paragraphs.map(part=>part.text)).toEqual(['Antes','Primera línea\nSegunda palabra.','Después'])
  const node=doc.querySelector('em').firstChild
  expect(paragraphs[1].text.slice(paragraphs[1].offsets.get(node),paragraphs[1].offsets.get(node)+node.length)).toBe('palabra')
})
it('uses the Ollama adapter without credentials and accepts its actual response format',async()=>{
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({message:{content:'Significa tranquilidad.'}})))
  expect(await requestContext({provider:'ollama',endpoint:'http://localhost:11434/api/chat',model:'installed-model',key:'never-forward-this',word:'sosiego',text:'El sosiego llegó.',language:'es',sourceLanguage:'es'},fetcher)).toBe('Significa tranquilidad.')
  const options=fetcher.mock.calls[0][1]
  expect(options.headers.Authorization).toBeUndefined();expect(JSON.parse(options.body)).toMatchObject({stream:false,options:{num_predict:700}})
})
it('uses the chat adapter for an explicit passage, disabling storage and redirects',async()=>{
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:'Peace arrived.'}}]})))
  const output=await requestContext({provider:'chat',endpoint:'https://service.example/v1/chat/completions',model:'chosen-model',key:'session-key',task:'translate',word:'sosiego',text:'El sosiego llegó.',language:'en',sourceLanguage:'es'},fetcher)
  expect(output).toBe('Peace arrived.')
  const options=fetcher.mock.calls[0][1],body=JSON.parse(options.body)
  expect(options).toMatchObject({redirect:'error',credentials:'omit',headers:{Authorization:'Bearer session-key'}})
  expect(body).toMatchObject({store:false,max_completion_tokens:700})
  expect(JSON.parse(body.messages[1].content)).toEqual({word:'sosiego',passage:'El sosiego llegó.',sourceLanguage:'es'})
})
it('does not contact an inactive engine or accept incompatible responses',async()=>{
  const fetcher=vi.fn(async()=>new Response('{"audio":"wrong format"}'))
  const input={provider:'none',endpoint:'https://service.example/api',model:'m',word:'palabra',text:'La palabra.',language:'es'}
  await expect(requestContext(input,fetcher)).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled()
  await expect(requestContext({...input,provider:'chat'},fetcher)).rejects.toThrow('compatible')
})
it('does not present a token-limited reply as a complete translation',async()=>{
  const fetcher=async()=>new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'Incomplete'}}]}))
  await expect(requestContext({provider:'chat',endpoint:'https://service.example/api',model:'m',word:'texto',text:'Texto para traducir.',task:'translate',language:'en'},fetcher)).rejects.toThrow('truncado')
})
