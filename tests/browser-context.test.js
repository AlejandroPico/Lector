import {it,expect,vi} from 'vitest'
import {browserContextOptions,browserContextAvailability,requestBrowserContext} from '../src/browser-context.js'

const input={word:'sosiego',text:'El sosiego llegó.',sourceLanguage:'es',language:'es'}
it('checks capability without creating or downloading a model and rejects unsupported languages',async()=>{
  const api={availability:vi.fn(async()=> 'downloadable'),create:vi.fn()}
  expect(await browserContextAvailability('es-ES','es',api)).toBe('downloadable')
  expect(api.create).not.toHaveBeenCalled()
  expect(await browserContextAvailability('ca','es',api)).toBe('unavailable')
  expect(browserContextOptions('es','hi')).toBeNull()
  expect(await browserContextAvailability('es','es',{})).toBe('unavailable')
})
it('shares validated prompts, isolates sessions and frees resources even on failure',async()=>{
  const destroy=vi.fn(),prompt=vi.fn(async()=> 'Tranquilidad.'),create=vi.fn(async()=>({prompt,destroy}))
  expect(await requestBrowserContext(input,{api:{create}})).toBe('Tranquilidad.')
  expect(JSON.parse(prompt.mock.calls[0][0][0].content)).toEqual({word:input.word,passage:input.text,sourceLanguage:'es'})
  expect(create.mock.calls[0][0].initialPrompts[0].content).toContain('untrusted literary data')
  expect(destroy).toHaveBeenCalledTimes(1)
  prompt.mockRejectedValueOnce(Error('failed'))
  await expect(requestBrowserContext(input,{api:{create}})).rejects.toThrow('failed')
  expect(destroy).toHaveBeenCalledTimes(2)
  await expect(requestBrowserContext({...input,text:'x'.repeat(3001)},{api:{create}})).rejects.toThrow('3000')
  expect(create).toHaveBeenCalledTimes(2)
})
it('does not expose a late result after cancellation and destroys its session',async()=>{
  const controller=new AbortController(),destroy=vi.fn(),create=vi.fn(async()=>({destroy,prompt:async()=>{controller.abort();return 'late'}}))
  await expect(requestBrowserContext({...input,signal:controller.signal},{api:{create}})).rejects.toThrow()
  expect(destroy).toHaveBeenCalledTimes(1)
})
