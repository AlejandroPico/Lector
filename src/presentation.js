import { projectFonts } from './font-resources.js'
export const fonts = [
  ['Georgia', 'Georgia, serif'], ['Palatino', '"Palatino Linotype", Palatino, serif'],
  ['Times New Roman', '"Times New Roman", Times, serif'], ['Arial', 'Arial, sans-serif'],
  ['Helvetica', 'Helvetica, Arial, sans-serif'], ['Verdana', 'Verdana, sans-serif'],
  ['Tahoma', 'Tahoma, sans-serif'], ['Trebuchet MS', '"Trebuchet MS", sans-serif'],
  ['Segoe UI', '"Segoe UI", system-ui, sans-serif'], ['Calibri', 'Calibri, Arial, sans-serif'],
  ['Cambria', 'Cambria, Georgia, serif'], ['Garamond', 'Garamond, Georgia, serif'],
  ['Baskerville', 'Baskerville, "Baskerville Old Face", Georgia, serif'],
  ['Book Antiqua', '"Book Antiqua", Palatino, serif'], ['Century Schoolbook', '"Century Schoolbook", Georgia, serif'],
  ['Lucida Sans', '"Lucida Sans Unicode", "Lucida Grande", sans-serif'],
  ['Courier New', '"Courier New", monospace'], ['system', 'system-ui, sans-serif'],
  ['Atkinson Hyperlegible', '"Atkinson Hyperlegible", sans-serif'], ['Lexend', 'Lexend, sans-serif'],
  ...projectFonts.map(font=>[font.id,`"${font.id}", serif`]),
]

// paper, surface, ink, muted, line, accent, highlight, hover
export const themes = [
  { id: 'auto', label: 'Automático', icon: 'auto' },
  { id: 'morning', label: 'Mañana', icon: 'sun', colors: ['#f9f8f4','#f4f3ed','#383d35','#73786d','#dddfd5','#5d7156','#dfe8c7','#eaede3'] },
  { id: 'afternoon', label: 'Tarde', icon: 'sunset', colors: ['#f3e8d6','#ede0ca','#574632','#7d6b52','#d8c8af','#8a6843','#e3d09f','#e9dcc5'] },
  { id: 'night', label: 'Noche', icon: 'moon', dark: true, colors: ['#1b201d','#232a25','#c5cebf','#99a393','#364038','#acc19c','#465739','#303b31'] },
  { id: 'comfort', label: 'Confort', icon: 'comfort', colors: ['#e9edde','#e0e6d3','#414c39','#647356','#ccd5bd','#5b7247','#cbd8af','#dce4ce'] },
  { id: 'natural', label: 'Natural', icon: 'leaf', colors: ['#e8efe5','#dde8d9','#2f4834','#5e7662','#c4d6bf','#416e4b','#bdd7b7','#d6e4d0'] },
  { id: 'contrast', label: 'Contraste', icon: 'contrast', dark: true, colors: ['#000000','#111111','#e4e4e4','#ababab','#363636','#d0d0d0','#333333','#202020'] },
  { id: 'spring', label: 'Primavera', icon: 'flower', colors: ['#f2eee9','#e9e3dc','#52404a','#836477','#d9cdd4','#8b5e79','#e6cddd','#e8dce5'] },
  { id: 'summer', label: 'Verano', icon: 'summer', colors: ['#fff4db','#f7eacd','#514631','#81714c','#dfd0ac','#8b6e25','#ecd899','#f3e5bd'] },
  { id: 'autumn', label: 'Otoño', icon: 'autumn', colors: ['#efe1d6','#e6d4c5','#584334','#866751','#d8c0af','#995f3f','#dfbd9e','#e5d0bf'] },
  { id: 'winter', label: 'Invierno', icon: 'snow', colors: ['#edf2f7','#e2eaf2','#344857','#64798a','#cbd7e3','#4a728e','#c7deef','#d9e6f1'] },
  { id: 'rain', label: 'Lluvia', icon: 'rain', dark: true, colors: ['#1c2630','#24323e','#c5d4df','#98b0c1','#3b5061','#9ebfd6','#35566e','#2d4050'] },
]
themes.push(
  { id:'sunny',label:'Soleado',icon:'sun',colors:['#fff8e6','#fff0c9','#4e422c','#8a754c','#e8d9b5','#a47923','#f0dea8','#f7e8bf'] },
  { id:'snowy',label:'Nevado',icon:'snow',colors:['#f7fafc','#edf4f8','#364b59','#758b9b','#dbe6ec','#527f9c','#daeaf5','#e7f0f6'] },
  { id:'windy',label:'Ventoso',icon:'wind',colors:['#edf4ef','#dfece5','#334d49','#6c8580','#cbded5','#477d70','#c9e4d8','#deeee5'] },
  { id:'energy',label:'Energía',icon:'bolt',colors:['#fff0df','#ffe3c8','#573b2a','#956d50','#edccb0','#ad612c','#f5c896','#fce0bc'] },
  { id:'calm',label:'Calma',icon:'calm',colors:['#e9f2f3','#dfeaec','#354c53','#6b848c','#ccdcdf','#487881','#c9e2e6','#d8e9ec'] },
  { id:'melancholy',label:'Melancolía',icon:'sad',dark:true,colors:['#242338','#302e46','#dbd7e9','#aaa2bd','#49435f','#b5a3d3','#514563','#3c354f'] },
  { id:'joy',label:'Alegría',icon:'smile',colors:['#f9f5df','#f0ebc8','#485334','#829060','#dde1b4','#718a3d','#dbe9a5','#e9efc4'] },
  { id:'love',label:'Amor',icon:'heart',colors:['#fbefef','#f4e1e4','#60424d','#977781','#e7cdd5','#a6627d','#edc5d5','#f3dce5'] },
)
export const themeById = (id,personal=[]) => [...themes,...personal].find(theme=>theme.id===id) ?? themes[1]
export const themeProperties = ['paper','surface','ink','muted','line','accent','highlight','hover']
export function validateTheme(input, keepId = false) {
  if (!input || !Array.isArray(input.colors) || input.colors.length!==8 || !input.colors.every(color=>typeof color==='string' && /^#[a-f\d]{6}$/i.test(color))) throw new Error('El tema necesita ocho colores hexadecimales válidos.')
  const label=String(input.label??'').trim().slice(0,48)
  if (!label) throw new Error('Escribe un nombre para el tema.')
  const rgb=input.colors[0].slice(1).match(/../g).map(value=>parseInt(value,16)/255)
  const dark=(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)<.45
  return {id:keepId && /^personal-[a-z\d-]+$/.test(input.id) ? input.id : `personal-${crypto.randomUUID()}`,label,icon:'palette',dark,colors:input.colors.map(color=>color.toLowerCase())}
}

export function selectBrowserVoice(voices, uri, language = 'es-ES') {
  const chosen = voices.find(voice => voice.voiceURI === uri)
  if (uri) return chosen ?? null
  const languageBase = language.split('-')[0].toLowerCase()
  const candidates = voices.filter(voice => voice.lang.toLowerCase().split('-')[0] === languageBase)
  const preferred = language.includes('-') ? language : globalThis.navigator?.languages?.find(locale=>locale.toLowerCase().split('-')[0]===languageBase) ?? language
  const rank = voice => (/google|natural|neural|online/i.test(voice.name) ? 20 : 0)
    + (voice.lang.toLowerCase() === preferred.toLowerCase() ? 50 : 0) + (voice.default ? 1 : 0)
  return candidates.sort((a, b) => rank(b) - rank(a))[0] ?? voices.find(voice => voice.default) ?? voices[0] ?? null
}
