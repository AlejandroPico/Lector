const path=require('node:path')
const extensions=new Set(['.epub','.mobi','.azw3','.docx','.pdf','.txt'])
function bookPath(filename){return typeof filename==='string'&&path.isAbsolute(filename)&&extensions.has(path.extname(filename).toLowerCase())}
function assetPath(root,value){
  try{const url=new URL(value);if(url.protocol!=='lector:'||url.hostname!=='app'||url.port||url.username||url.password)return null
    const pathname=decodeURIComponent(url.pathname)
    if(pathname.includes('\0')||pathname.includes('\\'))return null
    const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname)),relative=path.relative(root,target)
    return relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)?target:null
  }catch{return null}
}
module.exports={assetPath,bookPath}
