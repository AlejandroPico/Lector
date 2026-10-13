const files=import.meta.glob('../fuentes/**/*.{woff2,woff,ttf,otf}',{eager:true,query:'?url',import:'default'})
export const projectFonts=Object.entries(files).map(([path,url])=>({
  id:`project-font-${[...path].reduce((hash,char)=>(hash*31+char.charCodeAt(0))>>>0,0).toString(16)}`,
  label:path.split('/').at(-1).replace(/\.(woff2?|ttf|otf)$/i,'').replace(/[_-]/g,' '),url,project:true,
}))
const registered=new Map()
export const fontLabel=id=>registered.get(id)?.label ?? projectFonts.find(font=>font.id===id)?.label ?? id
export const fontCSS=id=>registered.get(id)?.css ?? ''
export async function registerFont(font) {
  const url=font.url ? new URL(font.url,document.baseURI).href : URL.createObjectURL(font.file)
  const css=`@font-face { font-family:"${font.id}";src:url("${url}");font-display:swap; }`
  const face=new FontFace(font.id,`url("${url}")`)
  try { await face.load() } catch (error) { if (!font.url) URL.revokeObjectURL(url); throw error }
  document.fonts.add(face)
  registered.set(font.id,{...font,url,css,face})
  return font
}
export function unregisterFont(id) {
  const font=registered.get(id)
  if (!font) return
  document.fonts.delete(font.face)
  if (!font.project) URL.revokeObjectURL(font.url)
  registered.delete(id)
}
