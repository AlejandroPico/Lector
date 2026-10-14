// Browser media controls describe real playback; this is not a Cast transport.
export function createMediaControls({session=globalThis.navigator?.mediaSession,Metadata=globalThis.MediaMetadata}={}) {
  let owner,cover,coverURL
  const actions=['play','pause','stop','seekbackward','seekforward','seekto']
  const attempt=fn=>{try{fn()}catch{ /* Optional browser capabilities must not block audio. */ }}
  function release(candidate) {
    if(owner!==candidate)return
    owner=undefined
    if(coverURL)URL.revokeObjectURL(coverURL)
    cover=coverURL=undefined
    if(session)attempt(()=>{session.metadata=null;session.playbackState='none'})
    for(const action of actions)attempt(()=>session?.setActionHandler(action,null))
    attempt(()=>session?.setPositionState?.())
  }
  function claim(candidate,{title='',artist='',album='',coverBlob},handlers) {
    if(!session||!Metadata)return
    if(cover!==coverBlob){if(coverURL)URL.revokeObjectURL(coverURL);cover=coverBlob;coverURL=undefined
      if(cover?.type.startsWith('image/'))attempt(()=>{coverURL=URL.createObjectURL(cover)})}
    owner=candidate
    attempt(()=>{session.metadata=new Metadata({title,artist,album,artwork:coverURL?[{src:coverURL,type:cover.type}]:[]})})
    for(const action of actions)attempt(()=>session.setActionHandler(action,handlers[action]?details=>{
      if(owner!==candidate)return
      // Promise failures are handled by playback itself, without unhandled rejections.
      try{Promise.resolve(handlers[action](details)).catch(()=>{})}catch{}
    }:null))
    attempt(()=>session.setPositionState?.())
    state(candidate,'playing')
  }
  function state(candidate,value){if(session&&owner===candidate)attempt(()=>{session.playbackState=value==='playing'?'playing':'paused'})}
  function position(candidate,audio){if(session&&owner===candidate&&Number.isFinite(audio.duration)&&audio.duration>0)attempt(()=>session.setPositionState?.({duration:audio.duration,playbackRate:audio.playbackRate,position:Math.min(audio.duration,Math.max(0,audio.currentTime))}))}
  return {claim,release,state,position}
}
