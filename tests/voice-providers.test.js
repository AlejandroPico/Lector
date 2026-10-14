import {describe,it,expect} from 'vitest'
import {voiceRequest,localEndpoint} from '../src/voice-providers.js'
import {defaults} from '../src/storage.js'
describe('voice provider contracts',()=>{
 it('local requests need no key and cannot silently send a book to the cloud',()=>{
  const request=voiceRequest('Hola',{...defaults,provider:'piper'},'secret')
  expect(request.url).toBe('http://127.0.0.1:5055/synthesize')
  expect(request.body).toMatchObject({text:'Hola',speaker_id:0,voice:'es_ES-sharvard-medium'})
  expect(JSON.stringify(request)).not.toContain('secret')
  expect(()=>localEndpoint('https://voice.example')).toThrow('localhost')
  expect(()=>localEndpoint('http://localhost:5000/?token=123')).toThrow()
 })
 it('ElevenLabs uses its own key header and voice route without OpenAI parameters',()=>{
  const request=voiceRequest('Hola',{...defaults,provider:'elevenlabs',elevenVoice:'abc123'},'session')
  expect(request.url).toBe('https://api.elevenlabs.io/v1/text-to-speech/abc123')
  expect(request.headers['xi-api-key']).toBe('session')
  expect(request.body).toMatchObject({text:'Hola',model_id:'eleven_multilingual_v2'})
  expect(request.body).not.toHaveProperty('input')
  expect(()=>voiceRequest('Hola',{...defaults,provider:'elevenlabs',elevenVoice:'../abc'},'session')).toThrow()
 })
})
