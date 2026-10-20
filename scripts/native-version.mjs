import {readFile,writeFile} from 'node:fs/promises'
const {version}=JSON.parse(await readFile('package.json','utf8'))
const {receiverApplicationId}=JSON.parse(await readFile('config/cast.json','utf8'))
if(receiverApplicationId&&(!/^[A-F0-9]{8}$/.test(receiverApplicationId)||receiverApplicationId==='CC1AD845'))throw Error('Invalid Cast application ID')
await writeFile('android/app/src/main/res/values/cast.xml',`<?xml version="1.0" encoding="utf-8"?>\n<resources><string name="lector_cast_app_id" translatable="false">${receiverApplicationId}</string></resources>\n`)
const [major,minor,patch]=version.split('.').map(Number),code=major*1000000+minor*1000+patch
const file='android/app/build.gradle'
let source=await readFile(file,'utf8');source=source.replace(/versionCode \d+/,`versionCode ${code}`).replace(/versionName "[^"]+"/,`versionName "${version}"`);await writeFile(file,source)
const apple='ios/App/App.xcodeproj/project.pbxproj'
let project=await readFile(apple,'utf8');project=project.replace(/(CURRENT_PROJECT_VERSION = )[\d.]+/g,`$1${version}`).replace(/(MARKETING_VERSION = )[\d.]+/g,`$1${version}`);await writeFile(apple,project)
