import {localVoices} from './voice-providers.js'
import {t} from './i18n.js'
export function addLocalVoiceMenus(){
 const provider=document.querySelector('[data-setting="provider"]')
 provider.insertAdjacentHTML('beforeend','<option value="piper">Piper · voz local sin nube</option><option value="elevenlabs">ElevenLabs</option>')
 document.getElementById('api-voice-settings').insertAdjacentHTML('afterend',`<div id="local-voice-settings" hidden><p class="notice small">Voz generada en tu equipo, sin clave ni coste de API. Requiere iniciar el motor local.</p><label class="field">Dirección local<input data-setting="localEndpoint" type="url"></label><button id="local-connect" class="text-button">Buscar voces locales</button><p id="local-voice-status" class="small muted" role="status"></p><label class="field">Voz local<select data-setting="localVoice" id="local-voices" data-user-content></select></label><label class="field">Interlocutor local<input data-setting="localSpeaker" type="number" min="0" max="999"></label><details class="settings-section"><summary>Variación de la voz local</summary><label class="field">Variación sonora<input data-setting="localNoise" type="number" min="0" max="2" step=".05"></label><label class="field">Variación fonética<input data-setting="localWidth" type="number" min="0" max="2" step=".05"></label><p class="small muted">Piper no interpreta instrucciones de emoción. La calidad y los idiomas dependen del modelo instalado.</p></details><a class="text-button" href="https://github.com/AlejandroPico/Lector/tree/main/voz-local" target="_blank" rel="noopener">Preparar voz local</a></div><div id="eleven-voice-settings" hidden><p class="notice small">El servicio recibirá el texto narrado y puede tener coste. La clave solo se conserva durante esta sesión.</p><label class="field">Dirección de ElevenLabs<input data-setting="elevenEndpoint" type="url"></label><label class="field">Modelo de ElevenLabs<input data-setting="elevenModel"></label><label class="field">Identificador de voz<input data-setting="elevenVoice"></label><label class="field">Estabilidad<input data-setting="elevenStability" type="number" min="0" max="1" step=".05"></label></div>`)
 // One session key shared by the chosen external service, outside provider-specific forms.
 const api=document.getElementById('api-voice-settings'),key=document.getElementById('api-key').closest('label')
 const keyGroup=document.createElement('div');keyGroup.id='external-voice-key';keyGroup.append(key,api.querySelectorAll('p')[1]);api.after(keyGroup)
}
export function createLocalVoiceTools({settings,save,onError}){
 const select=document.getElementById('local-voices'),status=document.getElementById('local-voice-status')
 function refresh(){
   document.getElementById('local-voice-settings').hidden=settings.provider!=='piper'
   document.getElementById('eleven-voice-settings').hidden=settings.provider!=='elevenlabs'
   document.getElementById('external-voice-key').hidden=!['openai','elevenlabs'].includes(settings.provider)
   if(settings.localVoice&&!Array.from(select.options).some(option=>option.value===settings.localVoice))select.add(new Option(settings.localVoice,settings.localVoice))
   select.value=settings.localVoice
 }
 document.getElementById('local-connect').onclick=async()=>{
   const button=document.getElementById('local-connect');button.disabled=true
   try{
     const voices=await localVoices(settings.localEndpoint,AbortSignal.timeout(10000))
     select.replaceChildren(...voices.map(voice=>new Option(`${voice.id} · ${voice.language} · ${voice.count}`,voice.id)))
     if(!voices.some(voice=>voice.id===settings.localVoice))settings.localVoice=voices[0]?.id??''
     save();refresh();status.textContent=`${voices.length} ${t('voces disponibles')}`
   }catch(error){status.textContent=t('Inicia el motor local y permite el acceso a la red local si el navegador lo solicita.');onError(error)}finally{button.disabled=false}
 }
 refresh();return {refresh}
}
