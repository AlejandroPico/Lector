import {icon} from './icons.js'
import {t} from './i18n.js'

export const bookScenes=[['auto','Automático','home'],['home','En casa','home'],['afternoon','Luz de tarde','home'],['night','Lectura nocturna','home'],['cabin','Cabaña en el bosque','cabin'],['school','Pupitre','school'],['office','Oficina','office'],['library','Biblioteca de cerezo','library'],['bamboo','Rincón de bambú','bamboo'],['garden','Jardín de roble claro','garden'],['study','Estudio de caoba','study'],['olive','Terraza de olivo','olive']]
export const automaticHint='Automático: mañana de 7 a 18 h, tarde de 18 a 22 h y noche de 22 a 7 h, según la hora del dispositivo.'
const $=selector=>document.querySelector(selector)
export const focusedBookPage=settings=>settings.appearance==='book'&&settings.bookMobileView!=='spread'&&matchMedia('(max-width:900px) and (orientation:portrait)').matches
export function addScenePicker(){
  const body=$('#theme-panel .shared-settings')
  body.insertAdjacentHTML('afterbegin',`<div class="appearance-switch" role="group" aria-label="Apariencia"><button type="button" data-appearance="minimal">Lectura minimalista</button><button type="button" data-appearance="book">Libro sobre la mesa</button></div><div id="scene-options" class="scene-options" hidden></div><label id="mobile-book-field" class="field" hidden>Vista en móvil<select data-setting="bookMobileView"><option value="page">Una página</option><option value="spread">Libro abierto</option></select></label>`)
  const select=$('[data-setting="bookScene"]');select.replaceChildren()
  for(const [id,label,image] of bookScenes){
    const option=document.createElement('option');option.value=id;option.textContent=label;select.append(option)
    const button=document.createElement('button');button.type='button';button.dataset.scene=id;button.className='scene-option';button.title=label
    const thumb=document.createElement('span');thumb.className=`scene-thumbnail scene-${id}`;thumb.style.backgroundImage=`url("${import.meta.env.BASE_URL}scenes/${image}.webp")`;thumb.setAttribute('aria-hidden','true')
    if(id==='auto')thumb.innerHTML=icon('sun')
    const name=document.createElement('span');name.textContent=label;button.append(thumb,name)
    button.onclick=()=>{select.value=id;select.dispatchEvent(new Event('input',{bubbles:true}))};$('#scene-options').append(button)
  }
  for(const button of body.querySelectorAll('[data-appearance]'))button.onclick=()=>{const select=$('[data-setting="appearance"]');select.value=button.dataset.appearance;select.dispatchEvent(new Event('input',{bubbles:true}))}
}
export function updateScenePicker(settings){
  const physical=settings.appearance==='book'
  $('#scene-options').hidden=!physical;$('#mobile-book-field').hidden=!physical
  $('#book-scene-field').hidden=true
  for(const button of document.querySelectorAll('[data-appearance]'))button.setAttribute('aria-pressed',String(button.dataset.appearance===settings.appearance))
  for(const button of document.querySelectorAll('[data-scene]')){button.setAttribute('aria-pressed',String(button.dataset.scene===settings.bookScene));button.title=button.dataset.sceneLabel??t(button.dataset.scene==='auto'?automaticHint:bookScenes.find(scene=>scene[0]===button.dataset.scene)?.[1]??'')}
  const automatic=document.querySelector('[data-theme="auto"]');if(automatic)automatic.title=t(automaticHint)
}
