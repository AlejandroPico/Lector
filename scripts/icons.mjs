import sharp from 'sharp'
import {readFile,mkdir,writeFile,access} from 'node:fs/promises'
const svg=await readFile('favicon.svg')
async function png(file,size){await mkdir(new URL('.',new URL(file,`file://${process.cwd().replaceAll('\\','/')}/`)),{recursive:true});await sharp(svg,{density:1200}).resize(size,size).png().toFile(file)}
for(const size of [192,512])await png(`public/icons/icon-${size}.png`,size)
await png('public/icons/apple-touch-icon.png',180)
await png('distribution/icons/icon.png',1024)
const exists=path=>access(path).then(()=>true,()=>false)
if(await exists('android/app/src/main/res')){
  for(const [density,size]of Object.entries({mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192})){
    await png(`android/app/src/main/res/mipmap-${density}/ic_launcher.png`,size)
    await png(`android/app/src/main/res/mipmap-${density}/ic_launcher_round.png`,size)
    await png(`android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`,size*2.25)
  }
  const banner=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#f7f5ef"/><path d="M64 44h30l14 11 14-11h30v68h-30l-14 12-14-12H64zM108 55v69" fill="none" stroke="#5d6a58" stroke-width="4"/><text x="186" y="94" fill="#383d35" font-family="sans-serif" font-size="29">Lector</text></svg>')
  for(const locale of ['', '-es','-ca','-en','-fr','-de','-pt','-it','-zh-rCN','-ja','-hi']){const directory=`android/app/src/main/res/drawable${locale}-xhdpi`;await mkdir(directory,{recursive:true});await sharp(banner).png().toFile(`${directory}/tv_banner.png`)}
}
if(await exists('ios/App/App/Assets.xcassets/AppIcon.appiconset')){
  await png('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png',1024)
  await writeFile('ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json',JSON.stringify({images:[{filename:'AppIcon-1024.png',idiom:'universal',platform:'ios',size:'1024x1024'}],info:{author:'xcode',version:1}},null,2)+'\n')
}
