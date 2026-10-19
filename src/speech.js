import { selectBrowserVoice } from './presentation.js'
import { ContinuousFollower } from './reading.js'
import {spokenSegment,AudioBudget,SleepTimer} from './audio-policy.js'
import {voiceRequest} from './voice-providers.js'
import {castSegments,narrationSettings} from './narration.js'
import {t} from './i18n.js'
export function splitSentences(text, limit = 1600, language = 'es',protectedTerms=[]) {
  const segmenter = new Intl.Segmenter(language, { granularity: 'sentence' })
  const segments = []
  const sentences=[]
  for(const item of segmenter.segment(text)){
    const previous=sentences.at(-1)
    if(previous&&protectedTerms.some(term=>term&&previous.segment.trimEnd().endsWith(term)))previous.segment+=item.segment
    else sentences.push({segment:item.segment,index:item.index})
  }
  for (const { segment, index } of sentences) {
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

export function documentSpeech(doc, language = 'es',protectedTerms=[]) {
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
  return splitSentences(text, 1600, language,protectedTerms).map(segment => ({
    ...segment, range: rangeFor(segment.start, segment.end),
    wordRange: (charIndex, length) => rangeFor(segment.start + charIndex,
      Math.min(segment.end, segment.start + charIndex + length)),
  })).filter(segment => segment.range)
}

// Slice the text and DOM range together when resuming inside a sentence.
export function speechFrom(segments, point, exact = false) {
  if (!point) return segments
  const first = segments.findIndex(segment => segment.range.compareBoundaryPoints(Range.START_TO_END, point) > 0)
  if (first < 0) return []
  const rest = segments.slice(first), segment = rest[0]
  if (!exact || segment.range.compareBoundaryPoints(Range.START_TO_START, point) >= 0) return rest
  // DOM text may contain hidden spans or omit the synthetic separators used
  // for narration. Find the offset through our mapped ranges instead.
  let low=0,high=segment.text.length
  while(low<high) {
    const middle=Math.floor((low+high)/2),range=segment.wordRange(middle,1)
    if(range.compareBoundaryPoints(Range.START_TO_START,point)<0) low=middle+1
    else high=middle
  }
  const offset=low
  const start = offset + segment.text.slice(offset).length - segment.text.slice(offset).trimStart().length
  rest[0] = { ...segment, text: segment.text.slice(start), range: segment.wordRange(start, segment.text.length-start),
    wordRange: (index,length) => segment.wordRange(start+index,length) }
  return rest.filter(item => item.text && item.range)
}

export function wordAtPoint(doc, x, y, language) {
  const caret = doc.caretPositionFromPoint?.(x,y)
  const range = caret ? null : doc.caretRangeFromPoint?.(x,y)
  const node = caret?.offsetNode ?? range?.startContainer, offset = caret?.offset ?? range?.startOffset
  if (!node || node.nodeType !== Node.TEXT_NODE) return null
  for (const word of new Intl.Segmenter(language,{granularity:'word'}).segment(node.textContent)) {
    if (!word.isWordLike || offset < word.index || offset > word.index+word.segment.length) continue
    const selected = doc.createRange()
    selected.setStart(node,word.index); selected.setEnd(node,word.index+word.segment.length)
    return selected
  }
  return null
}

// Reconstruct a device checkpoint against the original document, including pronunciation offsets.
export async function speechCheckpoint(view,checkpoint,settings,cast={}){
  const resolved=view.resolveNavigation(checkpoint.cfi),source=view.book.sections[resolved?.index]
  if(!source)return null
  const doc=source.createDocument?await source.createDocument():new DOMParser().parseFromString(await(await fetch(await source.load())).text(),'text/html')
  const point=resolved.anchor?.(doc),first=speechFrom(documentSpeech(doc,settings.language,settings.pronunciationsEnabled?settings.pronunciations.map(rule=>rule.from).filter(term=>term.includes('.')):[]),point,true)[0]
  if(!first)return checkpoint.cfi
  const part=castSegments(first,resolved.index,cast,view,settings.narrationEnabled)[0]
  const spoken=spokenSegment(part,narrationSettings(settings,cast,part.characterId)),at=Math.min(Math.max(0,checkpoint.charIndex||0),Math.max(0,spoken.text.length-1))
  return view.getCFI(resolved.index,spoken.wordRange(at,1))
}

// Page-sized fragments keep voices without boundary events on visible text.
export function speechPages(segments, renderer, language) {
  if (renderer.scrolled || !renderer.size) return segments
  return segments.flatMap(segment => {
    const doc = segment.range.startContainer.ownerDocument
    const vertical = doc.defaultView.getComputedStyle(doc.body).writingMode.startsWith('vertical')
    const cuts = [0]
    let page
    for (const word of new Intl.Segmenter(language,{granularity:'word'}).segment(segment.text)) {
      if (!word.isWordLike) continue
      const rect = [...segment.wordRange(word.index,word.segment.length).getClientRects()].find(rect => rect.width>0 && rect.height>0)
      if (!rect) continue
      const next = Math.floor((vertical ? rect.top : rect.left)/renderer.size)
      if (page !== undefined && next !== page) cuts.push(word.index)
      page = next
    }
    cuts.push(segment.text.length)
    return cuts.slice(0,-1).map((offset,index) => {
      const text = segment.text.slice(offset,cuts[index+1]).trimEnd()
      return { ...segment,sentenceRange:segment.range,text,get range(){return segment.wordRange(offset,text.length)},wordRange:(start,length)=>segment.wordRange(offset+start,length) }
    }).filter(item=>item.text && item.range)
  })
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
  constructor({ view, settings, getKey, onState, onError, onHighlight,onAudio=()=>{},onCursor=()=>{},getBookId=()=>'',onBrowseChange=()=>{},onActivity=()=>{},waitForView=()=>Promise.resolve(),getCast=()=>({}) }) {
    Object.assign(this, { view, settings, getKey, onState, onError, onHighlight })
    this.cache = new Map(); this.run = 0; this.state = 'stopped'; this.pending = new Set()
    this.browsing=false;this.onBrowseChange=onBrowseChange
    this.follower=new ContinuousFollower(view,()=>({...settings(),followSpeech:this.canFollow()}))
    this.onActivity=onActivity;this.history=[]
    this.waitForView=waitForView;this.documents=new WeakMap()
    this.getCast=getCast
    this.onAudio=onAudio
    this.onCursor=onCursor;this.getBookId=getBookId
    view.addEventListener('load',({detail:{doc,index}})=>this.documents.set(doc,index))
    this.budget=new AudioBudget(settings,()=>this.onActivity())
    this.timer=new SleepTimer(()=>{this.stop();this.onError('El temporizador ha detenido la lectura.')},()=>this.onActivity())
  }
  setState(state) { this.state = state;this.follower.setState(state);if(state==='playing'&&this.settings().sleepEnabled)this.timer.arm(this.settings().sleepMinutes);this.onState(state) }
  canFollow(){return this.settings().followSpeech&&!this.browsing&&!this.background}
  setBackground(value){this.background=value;if(value)this.follower.stop();else if(!this.browsing&&this.state==='playing')this.restoreCursor(this.run).catch(error=>this.onError(error.message))}
  browse(){if(this.state==='stopped'||this.browsing)return;this.browsing=true;this.follower.stop();this.onBrowseChange()}
  async returnToReading(){
    const run=this.run
    if(!this.cursorCFI||this.state==='stopped')return
    await this.waitForView();await this.view.renderer.whenNavigationIdle?.()
    if(run!==this.run)return
    await this.view.goTo(this.cursorCFI)
    if(run!==this.run)return
    this.browsing=false;this.onBrowseChange()
    await this.restoreCursor(run)
    if(run!==this.run)return
    const current=this.view.renderer.getContents()[0],target=this.view.resolveNavigation(this.cursorCFI)
    if(current?.index===target?.index){const range=target.anchor?.(current.doc);this.onHighlight(range);if(range)await this.view.renderer.scrollToAnchor(range,true)}
  }
  stop({keepTimer=false}={}) {
    this.diagnostics?.cancel()
    this.run++; this.abort?.abort(); this.abort = null
    this.follower.stop()
    this.browsing=false;this.cursorCFI=null;this.onBrowseChange()
    if(!keepTimer)this.timer.clear()
    globalThis.speechSynthesis?.cancel()
    this.audio?.pause(); this.audio = null
    for (const finish of this.pending) finish()
    this.pending.clear()
    this.nativeActive=false;this.nativeMap=null;this.nativeCache=null;this.nativeFingerprint=null
    this.onHighlight(null); this.setState('stopped')
  }
  async restart(range) { this.stop(); return this.toggle(range,true) }
  async toggle(startRange, exact = false) {
    if(this.diagnostics?.running){this.onError('Cancela la prueba de voces antes de iniciar la lectura.');return}
    if (this.state === 'playing') {
      if (this.audio) this.audio.pause()
      else globalThis.speechSynthesis?.pause()
      this.setState('paused'); return
    }
    if (this.state === 'paused') {
      this.readyResume?.()
      if (this.audio) await this.audio.play()
      else globalThis.speechSynthesis?.resume()
      this.setState('playing'); return
    }
    if (this.state === 'loading') {this.setState('paused');return}
    const settings = this.settings()
    if (settings.provider === 'browser' && !globalThis.speechSynthesis) {
      this.onError('Este navegador no dispone de lectura en voz alta.'); return
    }
    if (['openai','elevenlabs'].includes(settings.provider) && !this.getKey()) {
      this.onError('Introduce tu clave en los ajustes de voz antes de usar el servicio externo.'); return
    }
    const keepTimer=Boolean(this.rewinding);this.stop({keepTimer})
    if(this.historyBook!==this.view.book){this.historyBook=this.view.book;this.history=[]}
    const run = this.run
    await this.waitForView()
    await this.view.renderer.whenNavigationIdle?.()
    if(run!==this.run)return
    const visible = startRange ?? this.view.lastLocation?.range
    if(settings.provider==='browser'&&globalThis.speechSynthesis?.startQueue){await this.readNative(run,visible,exact);return}
    this.setState('playing')
    await this.readSection(run, visible, exact)
  }
  async nativeParts(index,point,exact){
    const source=this.view.book.sections[index]
    const doc=source.createDocument?await source.createDocument():new DOMParser().parseFromString(await(await fetch(await source.load())).text(),'text/html')
    const {settings,cast}=this.nativeConfig
    const anchor=point?this.view.resolveNavigation(point)?.anchor?.(doc):null
    const sentences=speechFrom(documentSpeech(doc,settings.language,settings.pronunciationsEnabled?settings.pronunciations.map(rule=>rule.from).filter(term=>term.includes('.')):[]),anchor,exact)
    return sentences.flatMap(sentence=>castSegments(sentence,index,cast,this.view,settings.narrationEnabled)).flatMap(segment=>{
      const voiceSettings=narrationSettings(settings,cast,segment.characterId),spoken=spokenSegment(segment,voiceSettings)
      return splitSentences(spoken.text,3000,settings.language).map(cut=>({
        ...spoken,text:cut.text,range:spoken.wordRange(cut.start,cut.text.length),
        wordRange:(at,length)=>spoken.wordRange(cut.start+at,length),voiceSettings,
      }))
    })
  }
  async readNative(run,visible,exact){
    this.nativeActive=true;this.setState('loading')
    const start=this.view.renderer.getContents()[0]?.index??0
    const point=visible?this.view.getCFI(start,visible):null
    this.nativeConfig={settings:structuredClone(this.settings()),cast:structuredClone(this.getCast()??{}),start,point,exact}
    const items=[],map=[],voices=speechSynthesis.getVoices()
    const chapters=[];const visit=entries=>{for(const entry of entries??[]){const resolved=this.view.resolveNavigation(entry.href);if(Number.isInteger(resolved?.index))chapters.push({section:resolved.index,anchor:resolved.anchor,label:entry.label??''});visit(entry.subitems)}};visit(this.view.book.toc)
    try{
      for(let index=start;index<this.view.book.sections.length;index++){
        if(this.view.book.sections[index].linear==='no')continue
        const parts=await this.nativeParts(index,index===start?point:null,index===start&&exact)
        if(run!==this.run)return
        if(index===start)this.nativeCache={index,promise:Promise.resolve(parts)}
        for(let part=0;part<parts.length;part++){
          const segment=parts[part],settings=segment.voiceSettings,voice=selectBrowserVoice(voices,settings.voice,settings.language)
          if(settings.voice&&!voices.some(voice=>voice.voiceURI===settings.voice))throw Error(t('La voz guardada ya no está disponible en este navegador. Elige otra voz.'))
          const cfi=this.view.getCFI(index,segment.range)
          const chapter=chapters.findLast(item=>{if(item.section!==index)return item.section<index;if(!item.anchor)return true;try{const doc=segment.range.startContainer.ownerDocument,target=item.anchor(doc);if(target===0)return true;const range=target?.nodeType?doc.createRange():target;if(target?.nodeType)range.selectNodeContents(target);return range?.compareBoundaryPoints(Range.START_TO_START,segment.range)<=0}catch{return false}})?.label??''
          items.push({text:segment.text,cfi,chapter,characterId:segment.characterId??'narrator',voice:voice?.voiceURI??'',language:voice?.lang||settings.language,rate:settings.rate,pitch:settings.pitch,wpm:settings.narrationWpm||170})
          map.push({index,part,cfi})
        }
        // Yield while preparing long books; stopping cancels preparation as well.
        await new Promise(resolve=>setTimeout(resolve,0));if(run!==this.run)return
      }
      if(!items.length){this.stop();return}
      this.nativeMap=map
      this.setState(this.state==='paused'?'paused':'playing')
      const reading=speechSynthesis.startQueue({items,bookId:this.getBookId(),paused:this.state==='paused',deadline:this.timer.deadline||0},{
        onPosition:data=>this.nativePosition(data,run),
        onState:state=>{if(run===this.run&&['playing','paused'].includes(state)&&this.state!==state)this.setState(state)},
        onStop:data=>{if(data.reason==='sleep'&&run===this.run)this.onError(t('El temporizador ha detenido la lectura.'))},
      })
      this.updateNativeSettings();await reading
      if(run===this.run)this.stop()
    }catch(error){if(run===this.run){this.stop();this.onError(`${t('No se pudo reproducir la voz seleccionada')} (${error.message}).`)}}
  }
  async nativePosition(data,run){
    const entry=this.nativeMap?.[data.item];if(!entry||run!==this.run)return
    const ticket=this.nativeTicket=(this.nativeTicket??0)+1
    this.cursorCFI=entry.cfi;this.onCursor(this.cursorCFI)
    try{
      if(this.nativeCache?.index!==entry.index){const {start,point,exact}=this.nativeConfig;this.nativeCache={index:entry.index,promise:this.nativeParts(entry.index,entry.index===start?point:null,entry.index===start&&exact)}}
      const parts=await this.nativeCache.promise
      if(ticket!==this.nativeTicket||run!==this.run)return
      const segment=this.mappedSegment(parts[entry.part],entry.index),length=data.charLength||parts[entry.part].text.slice(data.charIndex).match(/^\S+/)?.[0].length||1
      // mappedSegment records the word CFI even while its chapter is not displayed.
      let word=segment.wordRange(data.charIndex||0,length)
      this.onCursor(this.cursorCFI)
      if(this.background)return
      await this.restoreCursor(run)
      if(ticket!==this.nativeTicket||run!==this.run)return
      word=segment.wordRange(data.charIndex||0,length)
      this.follow(word,run);this.onHighlight(this.settings().highlightMode==='sentence'?segment.range:word)
    }catch(error){if(run===this.run)this.onError(error.message)}
  }
  updateNativeSettings(){
    if(!this.nativeActive||!this.nativeMap||!speechSynthesis.configure)return
    const settings=this.settings(),cast=this.getCast()??{},voices=speechSynthesis.getVoices(),characters={}
    for(const id of ['narrator',...(cast.characters??[]).map(item=>item.id)]){const config=narrationSettings(settings,cast,id),voice=selectBrowserVoice(voices,config.voice,config.language);characters[id]={voice:config.voice||voice?.voiceURI||'',language:voice?.lang||config.language,rate:config.rate,pitch:config.pitch,wpm:config.narrationWpm||170}}
    const fingerprint=JSON.stringify([characters,settings.sleepEnabled,settings.sleepMinutes]);if(this.nativeFingerprint===fingerprint)return;this.nativeFingerprint=fingerprint
    if(!settings.sleepEnabled)this.timer.clear();else this.timer.arm(settings.sleepMinutes)
    speechSynthesis.configure({characters,deadline:this.timer.deadline||0}).catch(error=>this.onError(error.message))
  }
  follow(range, run = this.run) {
    if (run !== this.run || !this.canFollow()) return
    if(!range){this.restoreCursor(run).catch(error=>{if(run===this.run)this.onError(error.message)});return}
    if(this.view.renderer?.scrolled){this.follower.word(range);return}
    const visible = this.view.lastLocation?.range
    if (visible && visible.startContainer.ownerDocument === range.startContainer.ownerDocument
      && range.compareBoundaryPoints(Range.START_TO_START,visible)>=0
      && range.compareBoundaryPoints(Range.END_TO_END,visible)<=0) return
    this.view.renderer.scrollToAnchor(range,true).catch(error=>{ if (run===this.run) this.onError(error.message) })
  }
  // Speech owns its document. The renderer may replace its iframe while the
  // same utterance is speaking; CFIs resolve into whichever page is visible.
  mappedSegment(segment, index) {
    const resolve = (range, cursor=true) => {
      if (!range) return null
      const cfi = this.view.getCFI(index, range)
      if(cursor)this.cursorCFI = cfi
      const current = this.view.renderer.getContents()[0]
      if (current?.index !== index || this.documents.get(current.doc)!==index) return null
      return this.view.resolveNavigation(cfi)?.anchor?.(current.doc) ?? null
    }
    return {...segment, cfi:this.view.getCFI(index,segment.range),
      get range(){return resolve(segment.range,false)},
      wordRange:(start,length)=>resolve(segment.wordRange(start,length))}
  }
  async restoreCursor(run) {
    if (!this.cursorCFI || run !== this.run || !this.canFollow() || this.restoring) return
    this.restoring=true
    try {
      await this.waitForView()
      await this.view.renderer.whenNavigationIdle?.()
      if(run!==this.run||!this.canFollow())return
      const target=this.cursorCFI,resolved=this.view.resolveNavigation(target),current=this.view.renderer.getContents()[0]
      if(current?.index===resolved?.index&&this.documents.get(current.doc)===resolved.index)return
      await this.view.goTo(target)
      if(run!==this.run||!this.canFollow())return
      const active=this.view.renderer.getContents()[0],position=this.view.resolveNavigation(this.cursorCFI)
      if(active?.index===position?.index){const range=position.anchor?.(active.doc);this.onHighlight(range);this.follower.word(range)}
    } finally {this.restoring=false}
  }
  async readSection(run, visible, exact = false, sectionIndex) {
    if (run !== this.run) return
    try {
      const current = this.view.renderer.getContents()[0]
      const index=sectionIndex??current.index, source=this.view.book.sections[index]
      const origin=visible&&this.view.getCFI(index,visible)
      const ready=current?.index===index&&this.documents.get(current.doc)===index
      const doc = ready ? current.doc.cloneNode(true)
        : source.createDocument ? await source.createDocument()
        : new DOMParser().parseFromString(await(await fetch(await source.load())).text(),'text/html')
      if(run!==this.run)return
      const point=origin?this.view.resolveNavigation(origin)?.anchor?.(doc):null
      const settings = this.settings()
      const sentences = speechFrom(documentSpeech(doc,settings.language,settings.pronunciationsEnabled?settings.pronunciations.map(rule=>rule.from).filter(term=>term.includes('.')):[]),point,exact)
      for(const sentence of sentences){
      let segments=castSegments(sentence,index,this.getCast(),this.view,this.settings().narrationEnabled).map(segment=>this.mappedSegment(segment,index))
      const active=this.view.renderer.getContents()[0]
      if(this.canFollow()&&active?.index===index&&this.documents.get(active.doc)===index)segments=speechPages(segments,this.view.renderer,this.settings().language)
      for (let i = 0; i < segments.length; i++) {
        if (run !== this.run) return
        const segment = segments[i]
        const reference=segment.cfi
        if(reference&&this.history.at(-1)?.cfi!==reference){this.history.push({cfi:reference,seconds:segment.text.split(/\s+/).length/(this.settings().narrationWpm||170)*60/this.settings().rate});this.history=this.history.slice(-150);this.onActivity()}
        this.cursorCFI=reference
        await this.restoreCursor(run)
        if (this.canFollow() && !this.view.renderer.scrolled && segment.range) await this.view.renderer.scrollToAnchor(segment.range,true)
        if (run !== this.run) return
        this.onHighlight(segment.range)
        if (this.settings().provider !== 'browser') await this.speakAPI(segment, run)
        else await this.speakBrowser(segment, run)
      }
      }
      if (run !== this.run) return
      let next = index + 1
      while (this.view.book.sections[next]?.linear === 'no') next++
      if (next < this.view.book.sections.length) {
        await this.readSection(run,undefined,false,next)
      } else this.stop()
    } catch (error) {
      if (run === this.run) { this.stop(); this.onError(error.message || 'No se pudo reproducir la voz.') }
    }
  }
  speakBrowser(segment, run, {preview=false}={}) {
    return new Promise((resolve, reject) => {
      const settings = narrationSettings(this.settings(),preview?{}:this.getCast(),segment.characterId)
      segment=spokenSegment(segment,settings)
      const utterance = new SpeechSynthesisUtterance(segment.text)
      const startFollowing=()=>{if(segment.range && this.view.renderer?.scrolled && this.canFollow() && run===this.run && this.follower.segment!==segment){this.follower.begin(segment,settings.rate);this.follower.setState(this.state)}}
      utterance.onstart=startFollowing
      const voices = speechSynthesis.getVoices()
      utterance.voice = selectBrowserVoice(voices, settings.voice, settings.language)
      if(settings.voice && !voices.some(voice=>voice.voiceURI===settings.voice)) {
        reject(new Error(t('La voz guardada ya no está disponible en este navegador. Elige otra voz.')));return
      }
      // A manually selected voice carries its own locale (including country).
      utterance.lang = utterance.voice?.lang || settings.language; utterance.rate = settings.rate; utterance.pitch = settings.pitch
      utterance.onboundary = event => {
        if (run !== this.run || event.name !== 'word') return
        if(this.view.renderer?.scrolled&&this.follower.segment!==segment)startFollowing()
        const tail = segment.text.slice(event.charIndex)
        const length = event.charLength || tail.match(/^\S+/)?.[0].length || 1
        const word = segment.wordRange ? segment.wordRange(event.charIndex,length) : segment.range
        this.follow(word,run)
        this.onHighlight(this.settings().highlightMode==='sentence' ? segment.range : word)
      }
      const finish = () => {this.follower.stop(); this.pending.delete(finish); resolve() }
      this.pending.add(finish)
      utterance.onend = finish
      utterance.onerror = event => {
        this.pending.delete(finish)
        if (event.error === 'interrupted' || event.error === 'canceled' || run !== this.run) resolve()
        else reject(new Error(`${t('No se pudo reproducir la voz seleccionada')}${utterance.voice?.name?`: ${utterance.voice.name}`:''} (${event.error}). ${t('El navegador o su servicio de voz ha rechazado la lectura. Prueba esta voz en «Leer en voz alta» del navegador. No se ha cambiado por otra voz.')}`))
      }
      // Retain the utterance: Chromium can discard its callbacks otherwise.
      this.utterance = utterance
      speechSynthesis.speak(utterance)
    })
  }
  async rewind(){
    if(this.nativeActive){await speechSynthesis.rewind?.({seconds:this.settings().rewindMode==='seconds'?this.settings().rewindSeconds:0});return}
    if(this.audio&&this.settings().rewindMode==='seconds'&&this.audio.currentTime>this.settings().rewindSeconds){this.audio.currentTime-=this.settings().rewindSeconds;return}
    if(this.historyBook!==this.view.book||!this.history.length)return
    let position=Math.max(0,this.history.length-2)
    if(this.settings().rewindMode==='seconds'){let seconds=0;while(position>0&&seconds<this.settings().rewindSeconds){seconds+=this.history[position].seconds;position--}}
    const target=this.history[position];this.history=this.history.slice(0,position);this.rewinding=true
    this.stop({keepTimer:true})
    try{await this.view.goTo(target.cfi);const current=this.view.renderer.getContents()[0],resolved=this.view.resolveNavigation(target.cfi),reading=this.toggle(resolved.anchor?.(current.doc),true);this.rewinding=false;await reading}finally{this.rewinding=false}
  }
  cacheKey(text,settings=this.settings()){const request=voiceRequest(text,settings,'cache');return JSON.stringify([settings.provider,request.url,request.body])}
  async generateAudio(text,{signal,settings={...this.settings()}}={}){
    if(!text.trim()||text.length>4096)throw new Error('La pronunciación ampliada supera el límite del fragmento. Acorta las reglas.')
    const requestData=voiceRequest(text,settings,this.getKey())
    const cacheKey=this.cacheKey(text,settings)
    if(this.cache.has(cacheKey))return this.cache.get(cacheKey)
    const request=async()=>{
      signal?.throwIfAborted();if(this.cache.has(cacheKey))return this.cache.get(cacheKey);if(settings.provider!=='piper')this.budget.reserve(text)
      const response = await fetch(requestData.url, {
        method: 'POST', signal: AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(120000)]), redirect: 'error',credentials:'omit',referrerPolicy:'no-referrer',
        headers: requestData.headers,body:JSON.stringify(requestData.body),
      })
      if (!response.ok) {
        const message = response.status === 401 ? 'La clave de API no es válida.' : response.status === 429
          ? 'El servicio de voz ha alcanzado su límite o no tiene saldo.' : `El servicio de voz respondió con el error ${response.status}.`
        throw new Error(message)
      }
      const reader=response.body.getReader(),chunks=[],limit=(settings.audioResponseLimitMB||16)*1024*1024;let size=0
      try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw new Error('El audio recibido supera el límite de tamaño configurado.');chunks.push(value)}}catch(error){await reader.cancel().catch(()=>{});throw error}
      const blob=new Blob(chunks,{type:response.headers.get('Content-Type')?.split(';')[0]||''})
      if (!blob.size || !/^audio\//i.test(blob.type)) throw new Error('El servicio no ha devuelto un archivo de audio válido.')
      signal?.throwIfAborted()
      // Bounded session cache avoids repeated charges when replaying recent passages.
      while(this.cache.size&&(this.cache.size>=80||[...this.cache.values()].reduce((sum,item)=>sum+item.size,0)+blob.size>32*1024*1024))this.cache.delete(this.cache.keys().next().value)
      this.cache.set(cacheKey, blob)
      return blob
    }
    return navigator.locks?navigator.locks.request('lector-audio-budget',{...(signal?{signal}:{})},request):request()
  }
  async speakAPI(segment, run, {preview=false}={}) {
    const settings=narrationSettings(this.settings(),preview?{}:this.getCast(),segment.characterId);segment=spokenSegment(segment,settings)
    this.setState('loading');this.abort=new AbortController()
    const blob=await this.generateAudio(segment.text,{signal:this.abort.signal,settings})
    if (run !== this.run) return
    if(this.state==='paused')await new Promise(resolve=>{const finish=()=>{this.pending.delete(finish);this.readyResume=null;resolve()};this.pending.add(finish);this.readyResume=finish})
    if(run!==this.run)return
    const url = URL.createObjectURL(blob)
    const audio = this.audio = new Audio(url)
    audio.playbackRate = settings.rate
    audio.onplaying=()=>{if(run!==this.run)return;this.onAudio(audio,segment);if(segment.range && this.view.renderer?.scrolled && this.canFollow()){if(this.follower.segment!==segment)this.follower.begin(segment,settings.rate,true);this.follower.setState(this.state)}}
    audio.ontimeupdate=()=>{if(Number.isFinite(audio.duration)&&audio.duration>0)this.follower.progress(audio.currentTime/audio.duration)}
    this.setState('playing')
    try {
      await new Promise((resolve, reject) => {
        const finish = () => {this.follower.stop(); this.pending.delete(finish); resolve() }
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
