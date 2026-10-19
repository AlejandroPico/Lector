import {paperContrast} from './paper-light.js'
import {t} from './i18n.js'

export function addPaperLightControls(){
  document.querySelector('#scene-options').insertAdjacentHTML('beforebegin',`<details id="paper-light-settings" class="settings-section" hidden><summary>Luz del papel</summary>
  <label class="check-field"><input type="checkbox" data-setting="paperLightEnabled">Personalizar la luz del papel</label>
  <div id="paper-light-controls" hidden>
  <label class="field range-field"><span>Intensidad de luz<output for="paperBrightness" data-output="paperBrightness"></output></span><input id="paperBrightness" type="range" min="60" max="140" step="1" data-setting="paperBrightness" data-unit=" %"></label>
  <label class="field range-field"><span>Calidez<output for="paperWarmth" data-output="paperWarmth"></output></span><input id="paperWarmth" type="range" min="-100" max="100" step="1" data-setting="paperWarmth" title="De fría a cálida"></label>
  <label class="check-field"><input type="checkbox" data-setting="paperInverted">Invertir papel y texto</label>
  <label class="check-field"><input type="checkbox" data-setting="paperCustomColors">Elegir colores del papel y texto</label>
  <div id="paper-light-colors" class="color-fields"><label>Color del papel<input type="color" data-setting="paperBackground"></label><label>Color del texto<input type="color" data-setting="paperInk"></label></div>
  <p id="paper-light-warning" class="small muted" role="status" hidden>El contraste entre el papel y el texto es bajo.</p>
  </div><button id="paper-light-reset" class="text-button">Restablecer luz del papel</button></details>`)
}
export function updatePaperLightControls(settings,paper){
  document.querySelector('#paper-light-settings').hidden=settings.appearance!=='book'
  document.querySelector('#paper-light-controls').hidden=!settings.paperLightEnabled
  document.querySelector('#paper-light-colors').hidden=!settings.paperCustomColors
  document.querySelector('#paper-light-warning').hidden=!settings.paperLightEnabled||paperContrast(paper.bg,paper.ink)>=4.5
  document.body.classList.toggle('paper-light-adjusted',settings.appearance==='book'&&settings.paperLightEnabled)
  document.querySelector('#paper-light-warning').textContent=t('El contraste entre el papel y el texto es bajo.')
}
