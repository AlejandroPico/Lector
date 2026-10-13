const DB_NAME = 'lector-zen'
let connection

async function db() {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('books', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return connection
}

async function transact(mode, action) {
  const database = await db()
  return new Promise((resolve, reject) => {
    const tx = database.transaction('books', mode)
    const request = action(tx.objectStore('books'))
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
  justify: false, animated: false, highlight: true, provider: 'browser',
  voice: '', rate: 1, pitch: 1, language: 'es-ES',
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
  clamp('width', 640, 1800); clamp('gutter', 3, 12)
  clamp('rate', 0.5, 2); clamp('pitch', 0.5, 1.5)
  if (!['auto', 'morning', 'afternoon', 'night', 'comfort'].includes(value.theme)) value.theme = 'auto'
  if (!['Georgia', 'Palatino', 'Literata', 'system', 'Verdana'].includes(value.font)) value.font = 'Georgia'
  if (!['browser', 'openai'].includes(value.provider)) value.provider = 'browser'
  return value
}
