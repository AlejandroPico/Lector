export const supportedFormats = ['epub','azw3','mobi','docx','pdf','txt','fb2']
export const extension = name => name.split('.').pop().toLowerCase()
const withoutExtension = name => name.replace(/\.[^.]+$/, '')
const withoutCalibreID = name => name.replace(/\s*\(\d+\)$/, '').trim()

export function groupDirectory(entries, path) {
  const metadata = entries.find(handle => handle.name.toLowerCase() === 'metadata.opf')
  const cover = entries.find(handle => /^cover\.(jpe?g|png|webp|svg)$/i.test(handle.name))
  const files = entries.filter(handle => handle.kind === 'file' && supportedFormats.includes(extension(handle.name)))
  const groups = new Map()
  for (const handle of files) {
    const name = metadata ? path.at(-1) : withoutExtension(handle.name)
    const key = metadata ? 'calibre' : name.toLocaleLowerCase()
    if (!groups.has(key)) groups.set(key, {
      path: path.join('/'), title: withoutCalibreID(metadata ? path.at(-1) : name),
      author: metadata && path.length > 1 ? path.at(-2) : '',
      metadata, cover, formats: [],
    })
    groups.get(key).formats.push({ extension: extension(handle.name), handle, name: handle.name })
  }
  return [...groups.values()].map(group => {
    group.formats.sort((a,b) => supportedFormats.indexOf(a.extension) - supportedFormats.indexOf(b.extension))
    group.key = `${group.path}/${group.formats[0].name}`
    return group
  })
}

export async function scanDirectory(root, { signal, onProgress = () => {} } = {}) {
  const result = [], queue = [{ handle: root, path: [root.name] }]
  let visited = 0, directories = 0
  while (queue.length) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
    const { handle, path } = queue.pop(), entries = []
    for await (const entry of handle.values()) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
      if (++visited > 200000) throw new Error('La carpeta supera el límite de 200.000 entradas.')
      if (entry.kind === 'directory') queue.push({ handle: entry, path: [...path, entry.name] })
      else entries.push(entry)
    }
    result.push(...groupDirectory(entries, path)); directories++
    onProgress({ directories, books: result.length })
    if (directories % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0))
  }
  return result.sort((a,b) => a.title.localeCompare(b.title))
}

export async function ensureFolderPermission(handle) {
  const options = { mode: 'read' }
  if (await handle.queryPermission(options) === 'granted') return
  if (await handle.requestPermission(options) !== 'granted') throw new Error('La carpeta requiere permiso de lectura. Vuelve a seleccionarla.')
}

export async function readMetadata(entry) {
  if (!entry.metadata) return {}
  const file = await entry.metadata.getFile()
  if (file.size > 2 * 1024 * 1024) throw new Error('Los metadatos superan el límite de 2 MB.')
  const doc = new DOMParser().parseFromString(await file.text(), 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('El archivo metadata.opf no es válido.')
  const values = tag => [...doc.getElementsByTagNameNS('*', tag)].map(el => el.textContent.trim()).filter(Boolean)
  return { title: values('title')[0], author: values('creator').join(', '), language: values('language')[0] }
}
