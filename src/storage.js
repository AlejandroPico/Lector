import { fonts, themes } from './presentation.js'
const DB_NAME = 'lector-zen'
let connection

async function db() {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('books')) request.result.createObjectStore('books', { keyPath: 'id' })
      if (!request.result.objectStoreNames.contains('folders')) request.result.createObjectStore('folders', { keyPath: 'id' })
    }
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); connection = undefined }
      resolve(request.result)
    }
    request.onblocked = () => { connection = undefined; reject(new Error('Cierra otras pestañas del lector y vuelve a abrirlo para actualizar la biblioteca.')) }
    request.onerror = () => reject(request.error)
  })
  return connection
}

async function transact(mode, action, storeName = 'books') {
  const database = await db()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, mode)
    const request = action(tx.objectStore(storeName))
    tx.oncomplete = () => resolve(request.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export const getBook = id => transact('readonly', store => store.get(id))
export const saveBook = book => transact('readwrite', store => store.put(book))
export const removeBook = id => transact('readwrite', store => store.delete(id))
export const allBooks = async () => (await transact('readonly', store => store.getAll()))
  .sort((a, b) => b.updatedAt - a.updatedAt)
export const allFolders = () => transact('readonly', store => store.getAll(), 'folders')
export const saveFolder = folder => transact('readwrite', store => store.put(folder), 'folders')
export const removeFolder = id => transact('readwrite', store => store.delete(id), 'folders')

export async function fileId(file) {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback }
  catch { return fallback }
}

export function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true }
  catch { return false }
}

export const defaults = Object.freeze({
  theme: 'auto', font: 'Georgia', fontSize: 21, lineHeight: 1.75,
  paragraphGap: 0.8, columns: 2, width: 1320, gutter: 7,
  justify: false, animated: true, highlight: true, provider: 'browser', uiLanguage: 'auto',
  appearance: 'minimal', libraryView: 'list', fullWidth: false,
  followSpeech: true, clickToRead: true, highlightMode: 'word',
  voice: '', rate: 1, pitch: 1, language: 'es-ES', speechLanguage: 'auto',
  endpoint: 'https://api.openai.com/v1/audio/speech',
  model: 'gpt-4o-mini-tts', apiVoice: 'coral',
  instructions: 'Narra el texto íntegro en español de España, con entonación natural y expresiva. Respeta las pausas y no añadas ni omitas palabras.',
})

export function effectiveTheme(theme, hour = new Date().getHours()) {
  if (theme !== 'auto') return theme
  return hour >= 7 && hour < 18 ? 'morning' : hour >= 18 && hour < 22 ? 'afternoon' : 'night'
}

export function safeSettings(input = {}) {
  const value = { ...defaults, ...input }
  const clamp = (key, min, max) => {
    const number = Number(value[key])
    value[key] = Math.min(max, Math.max(min, Number.isFinite(number) ? number : defaults[key]))
  }
  clamp('fontSize', 14, 36); clamp('lineHeight', 1.2, 2.4)
  clamp('paragraphGap', 0, 2); clamp('columns', 1, 3); value.columns = Math.round(value.columns)
  clamp('width', 640, 3840); clamp('gutter', 1, 12)
  clamp('rate', 0.5, 2); clamp('pitch', 0.5, 1.5)
  if (!themes.some(theme => theme.id === value.theme)) value.theme = 'auto'
  if (!fonts.some(([name]) => name === value.font)) value.font = 'Georgia'
  if (!['auto','es','ca','en','fr','de','pt','it','zh','ja','hi'].includes(value.uiLanguage)) value.uiLanguage = 'auto'
  if (!['auto','es','ca','en','fr','de','pt','it','zh','ja','hi'].includes(value.speechLanguage)) value.speechLanguage = 'auto'
  if (!['list','covers'].includes(value.libraryView)) value.libraryView = 'list'
  if (!['browser', 'openai'].includes(value.provider)) value.provider = 'browser'
  if (!['word','sentence'].includes(value.highlightMode)) value.highlightMode = 'word'
  return value
}
