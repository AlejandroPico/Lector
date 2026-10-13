import { readJSON, writeJSON } from './storage.js'

const base = {
  sosiego: 'Quietud, tranquilidad o serenidad.',
  umbral: 'Entrada de una casa; también, comienzo o límite a partir del cual ocurre algo.',
  tenue: 'De poca intensidad, fuerza o grosor.',
  efímero: 'Que dura poco tiempo.',
  inefable: 'Que resulta difícil o imposible de expresar con palabras.',
  crepúsculo: 'Claridad que hay antes de salir el sol o después de ponerse.',
  penumbra: 'Sombra débil entre la luz y la oscuridad.',
  remanso: 'Lugar donde una corriente de agua se hace lenta; también, lugar tranquilo.',
  melancolía: 'Tristeza sosegada, a veces sin una causa precisa.',
  parsimonia: 'Calma o lentitud al actuar.',
  taciturno: 'Callado, silencioso o de ánimo triste.',
  atisbar: 'Mirar con atención o empezar a percibir algo.',
  recóndito: 'Escondido, apartado o difícil de encontrar.',
  vetusto: 'Muy antiguo.',
  diáfano: 'Que deja pasar la luz; también, claro o fácil de comprender.',
  soslayar: 'Evitar o pasar por alto una dificultad o cuestión.',
  anhelo: 'Deseo intenso de algo.',
  albor: 'Primera luz del día; también, comienzo de algo.',
  enjuto: 'Delgado o seco.',
  estoico: 'Que muestra fortaleza y serenidad ante la adversidad.',
  incólume: 'Que no ha sufrido daño.',
  impasible: 'Que no manifiesta emoción o perturbación.',
  lúgubre: 'Sombrío, triste o relacionado con la muerte.',
  nimio: 'Insignificante o de poca importancia.',
  prolijo: 'Demasiado largo o detallado.',
  reticente: 'Que expresa reservas o desconfianza.',
  insólito: 'Raro, extraño o poco habitual.',
  perenne: 'Duradero o que se mantiene de forma continua.',
  bruma: 'Niebla, especialmente sobre el mar.',
  fulgor: 'Resplandor o brillo intenso.',
  inerte: 'Sin movimiento o actividad.',
  apacible: 'Tranquilo y agradable.',
  alameda: 'Paseo o lugar poblado de álamos u otros árboles.',
}

export const normalizeWord = word => word.trim().toLocaleLowerCase('es').replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')
export function lookup(word) {
  const key = normalizeWord(word)
  const custom = readJSON('lector-dictionary', {})
  return custom[key] ?? base[key] ?? null
}

export function importDictionary(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('El diccionario debe ser un objeto JSON de palabras y definiciones.')
  const entries = Object.entries(json)
  if (entries.length > 50000) throw new Error('El diccionario admite hasta 50.000 palabras.')
  const dictionary = Object.create(null)
  for (const [word, definition] of entries) {
    if (!normalizeWord(word) || typeof definition !== 'string' || definition.length > 10000) throw new Error('Cada palabra debe tener una definición de texto de hasta 10.000 caracteres.')
    dictionary[normalizeWord(word)] = definition
  }
  if (!writeJSON('lector-dictionary', dictionary)) throw new Error('No queda espacio en el navegador para este diccionario.')
  return entries.length
}
