import { selectBrowserVoice } from './presentation.js'
export function splitSentences(text, limit = 1600, language = 'es') {
  const segmenter = new Intl.Segmenter(language, { granularity: 'sentence' })
  const segments = []
  for (const { segment, index } of segmenter.segment(text)) {
    let offset = 0
    while (offset < segment.length) {
      let end = Math.min(segment.length, offset + limit)
      if (end < segment.length) {
        const space = segment.lastIndexOf(' ', end)
        if (space > offset) end = space + 1
      }
      const slice = segment.slice(offset, end)
      const leading = slice.length - slice.trimStart().length
      if (slice.trim()) segments.push({ text: slice.trim(), start: index + offset + leading,
        end: index + offset + slice.trimEnd().length })
      offset = end
    }
  }
  return segments
}

export function documentSpeech(doc, language = 'es') {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.parentElement?.closest('[data-no-speech],script,style,button,nav,[hidden],rt,rp')
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    },
  })
  const nodes = []
  let text = '', lastBlock
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const block = node.parentElement.closest('p,h1,h2,h3,h4,h5,h6,li,blockquote,div')
    if (lastBlock && block !== lastBlock) text += '\n'
    lastBlock = block
    nodes.push({ node, start: text.length, end: text.length + node.textContent.length })
    text += node.textContent
  }
  const rangeFor = (start, end) => {
    const first = nodes.find(item => item.end > start)
    const last = [...nodes].reverse().find(item => item.start < end)
    if (!first || !last) return null
    const range = doc.createRange()
    range.setStart(first.node, Math.max(0, start - first.start))
    range.setEnd(last.node, Math.min(last.node.length, end - last.start))
    return range
  }
  return splitSentences(text, 1600, language).map(segment => ({
    ...segment, range: rangeFor(segment.start, segment.end),
    wordRange: (charIndex, length) => rangeFor(segment.start + charIndex,
      Math.min(segment.end, segment.start + charIndex + length)),
  })).filter(segment => segment.range)
}

export function validateEndpoint(value) {
  const url = new URL(value)
  if (url.username || url.password || url.hash || url.search) throw new Error('Usa una dirección sin credenciales, parámetros ni fragmentos.')
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('El servicio de voz debe usar HTTPS, o HTTP en localhost.')
  }
  return url.href
}

export class SpeechController {
  constructor({ view, settings, getKey, onState, onError, onHighlight }) {
    Object.assign(this, { view, settings, getKey, onState, onError, onHighlight })
    this.cache = new Map(); this.run = 0; this.state = 'stopped'; this.pending = new Set()
  }
  setState(state) { this.state = state; this.onState(state) }
  stop() {
    this.run++; this.abort?.abort(); this.abort = null
    globalThis.speechSynthesis?.cancel()
    this.audio?.pause(); this.audio = null
    for (const finish of this.pending) finish()
    this.pending.clear()
    this.onHighlight(null); this.setState('stopped')
  }
  async toggle(startRange) {
    if (this.state === 'playing') {
      if (this.audio) this.audio.pause()
      else globalThis.speechSynthesis?.pause()
      this.setState('paused'); return
    }
    if (this.state === 'paused') {
      if (this.audio) await this.audio.play()
      else globalThis.speechSynthesis?.resume()
      this.setState('playing'); return
    }
    if (this.state === 'loading') return
    const settings = this.settings()
    if (settings.provider === 'browser' && !globalThis.speechSynthesis) {
      this.onError('Este navegador no dispone de lectura en voz alta.'); return
    }
    if (settings.provider === 'openai' && !this.getKey()) {
      this.onError('Introduce tu clave en los ajustes de voz antes de usar el servicio externo.'); return
    }
    this.stop()
    const run = this.run
    const visible = startRange ?? this.view.lastLocation?.range
    this.setState('playing')
    await this.readSection(run, visible)
  }
  async readSection(run, visible) {
    if (run !== this.run) return
    try {
      const { doc, index } = this.view.renderer.getContents()[0]
      const segments = documentSpeech(doc, this.settings().language)
      let from = 0
      if (visible) {
        // START_TO_END compares this range's end with the source range's start.
        const found = segments.findIndex(segment => segment.range.compareBoundaryPoints(Range.START_TO_END, visible) > 0)
        if (found >= 0) from = found
      }
      if (!segments.length) { this.stop(); this.onError('Esta sección no contiene texto para narrar.'); return }
      for (let i = from; i < segments.length; i++) {
        if (run !== this.run) return
        const segment = segments[i]
        await this.view.renderer.scrollToAnchor(segment.range, true)
        if (run !== this.run) return
        this.onHighlight(segment.range)
        if (this.settings().provider === 'openai') await this.speakAPI(segment, run)
        else await this.speakBrowser(segment, run)
      }
      if (run !== this.run) return
      let next = index + 1
      while (this.view.book.sections[next]?.linear === 'no') next++
      if (next < this.view.book.sections.length) {
        await this.view.goTo(next)
        await this.readSection(run)
      } else this.stop()
    } catch (error) {
      if (run === this.run) { this.stop(); this.onError(error.message || 'No se pudo reproducir la voz.') }
    }
  }
  speakBrowser(segment, run) {
    return new Promise((resolve, reject) => {
      const settings = this.settings()
      const utterance = new SpeechSynthesisUtterance(segment.text)
      const voices = speechSynthesis.getVoices()
      utterance.voice = selectBrowserVoice(voices, settings.voice, settings.language)
      utterance.lang = settings.language; utterance.rate = settings.rate; utterance.pitch = settings.pitch
      utterance.onboundary = event => {
        if (run !== this.run || event.name !== 'word') return
        const tail = segment.text.slice(event.charIndex)
        const length = event.charLength || tail.match(/^\S+/)?.[0].length || 1
        this.onHighlight(segment.wordRange?.(event.charIndex, length) ?? segment.range)
      }
      const finish = () => { this.pending.delete(finish); resolve() }
      this.pending.add(finish)
      utterance.onend = finish
      utterance.onerror = event => {
        this.pending.delete(finish)
        if (event.error === 'interrupted' || event.error === 'canceled' || run !== this.run) resolve()
        else reject(new Error(`La voz del navegador no pudo continuar (${event.error}). Prueba otra voz.`))
      }
      // Retain the utterance: Chromium can discard its callbacks otherwise.
      this.utterance = utterance
      speechSynthesis.speak(utterance)
    })
  }
  async speakAPI(segment, run) {
    const settings = this.settings()
    const endpoint = validateEndpoint(settings.endpoint)
    const cacheKey = JSON.stringify([endpoint, settings.model, settings.apiVoice, settings.instructions, segment.text])
    let blob = this.cache.get(cacheKey)
    if (!blob) {
      this.setState('loading')
      this.abort = new AbortController()
      const response = await fetch(endpoint, {
        method: 'POST', signal: this.abort.signal, redirect: 'error',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.getKey()}` },
        body: JSON.stringify({ model: settings.model, voice: settings.apiVoice, input: segment.text,
          instructions: settings.instructions, response_format: 'mp3' }),
      })
      if (!response.ok) {
        const message = response.status === 401 ? 'La clave de API no es válida.' : response.status === 429
          ? 'El servicio de voz ha alcanzado su límite o no tiene saldo.' : `El servicio de voz respondió con el error ${response.status}.`
        throw new Error(message)
      }
      blob = await response.blob()
      if (!blob.size || !/^audio\//i.test(blob.type)) throw new Error('El servicio no ha devuelto un archivo de audio válido.')
      if (run !== this.run) return
      // Bounded session cache avoids repeated charges when replaying recent passages.
      if (this.cache.size >= 80) this.cache.delete(this.cache.keys().next().value)
      this.cache.set(cacheKey, blob)
    }
    if (run !== this.run) return
    const url = URL.createObjectURL(blob)
    const audio = this.audio = new Audio(url)
    audio.playbackRate = settings.rate
    this.setState('playing')
    try {
      await new Promise((resolve, reject) => {
        const finish = () => { this.pending.delete(finish); resolve() }
        const fail = error => { this.pending.delete(finish); reject(error) }
        this.pending.add(finish)
        audio.onended = finish
        audio.onerror = () => fail(new Error('No se pudo reproducir el audio recibido.'))
        audio.onpause = () => { if (run !== this.run) finish() }
        audio.play().catch(fail)
      })
    } finally { URL.revokeObjectURL(url); if (this.audio === audio) this.audio = null }
  }
}
