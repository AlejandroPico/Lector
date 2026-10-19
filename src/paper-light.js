const rgb=hex=>hex.slice(1).match(/../g).map(value=>parseInt(value,16))
const hex=channels=>'#'+channels.map(value=>Math.max(0,Math.min(255,Math.round(value))).toString(16).padStart(2,'0')).join('')
const valid=value=>typeof value==='string'&&/^#[a-f\d]{6}$/i.test(value)
export const mixPaperColor=(a,b,fraction)=>hex(rgb(a).map((value,index)=>value*(1-fraction)+rgb(b)[index]*fraction))
export function paperContrast(a,b){
  const luminance=color=>rgb(color).map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0)
  const [light,dark]=[luminance(a),luminance(b)].sort((a,b)=>b-a)
  return (light+.05)/(dark+.05)
}
export function illuminatePaper(base,settings={}){
  if(settings.paperLightEnabled!==true)return base
  let bg=settings.paperCustomColors===true&&valid(settings.paperBackground)?settings.paperBackground:base.bg
  let ink=settings.paperCustomColors===true&&valid(settings.paperInk)?settings.paperInk:base.ink
  if(settings.paperInverted===true)[bg,ink]=[ink,bg]
  const brightness=Number.isFinite(settings.paperBrightness)?Math.max(60,Math.min(140,settings.paperBrightness)):100
  const warmth=Number.isFinite(settings.paperWarmth)?Math.max(-100,Math.min(100,settings.paperWarmth)):0
  bg=hex(rgb(bg).map(channel=>channel*brightness/100))
  if(warmth)bg=mixPaperColor(bg,warmth>0?'#ffbf73':'#9ecbff',Math.abs(warmth)*.003)
  const accent=paperContrast(bg,base.accent)>=4.5?base.accent:ink
  const mark=paperContrast(base.mark,ink)>=4.5?base.mark:mixPaperColor(bg,ink,.15)
  return {bg,ink,accent,mark}
}
