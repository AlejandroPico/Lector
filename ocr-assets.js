import {readFileSync,readdirSync} from 'node:fs'
import {resolve} from 'node:path'
export function ocrAssets(){
  const files=new Map([['worker.min.js',resolve('node_modules/tesseract.js/dist/worker.min.js')]])
  for(const name of readdirSync('node_modules/tesseract.js-core'))if(/^tesseract-core.*\.wasm\.js$/.test(name))files.set(name,resolve('node_modules/tesseract.js-core',name))
  for(const language of ['eng','spa','cat','fra','deu','por','ita','chi_sim','jpn','hin'])files.set(`${language}.traineddata.gz`,resolve(`node_modules/@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`))
  files.set('LICENSE-TESSERACT.txt',resolve('node_modules/tesseract.js/LICENSE.md'))
  files.set('LICENSE-CORE.txt',resolve('node_modules/tesseract.js-core/LICENSE'))
  files.set('NOTICES.txt',resolve('OCR-NOTICES.txt'))
  return {name:'local-ocr-assets',configureServer(server){server.middlewares.use((req,res,next)=>{const name=req.url?.split('?')[0].replace(/^.*\/ocr\//,'');if(!req.url?.includes('/ocr/')||!files.has(name))return next();res.setHeader('Content-Type',name.endsWith('.gz')?'application/gzip':'application/javascript');res.end(readFileSync(files.get(name)))})},generateBundle(){for(const [name,path]of files)this.emitFile({type:'asset',fileName:`ocr/${name}`,source:readFileSync(path)})}}
}
