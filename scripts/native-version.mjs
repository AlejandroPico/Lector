import {readFile,writeFile} from 'node:fs/promises'
const {version}=JSON.parse(await readFile('package.json','utf8'))
const [major,minor,patch]=version.split('.').map(Number),code=major*1000000+minor*1000+patch
const file='android/app/build.gradle'
let source=await readFile(file,'utf8');source=source.replace(/versionCode \d+/,`versionCode ${code}`).replace(/versionName "[^"]+"/,`versionName "${version}"`);await writeFile(file,source)
