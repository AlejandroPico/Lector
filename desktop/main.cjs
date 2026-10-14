const {app,BrowserWindow,Menu,protocol,net,shell,ipcMain,dialog}=require('electron')
const path=require('node:path')
const fs=require('node:fs/promises')
const {pathToFileURL}=require('node:url')
const {assetPath,bookPath}=require('./paths.cjs')
const {createFolderStore}=require('./folders.cjs')
const ORIGIN='lector://app',quiet=process.env.LECTOR_TEST==='1'
let window,pendingBook,ready=false
app.setName('Lector')
if(process.env.LECTOR_TEST_USER_DATA)app.setPath('userData',process.env.LECTOR_TEST_USER_DATA)
protocol.registerSchemesAsPrivileged([{scheme:'lector',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}])
function trusted(event){return event.sender===window?.webContents&&event.senderFrame===window.webContents.mainFrame&&event.senderFrame.url.startsWith(ORIGIN+'/')}
async function selectedBook(filename){
  if(!bookPath(filename))return null
  const stat=await fs.stat(filename)
  if(!stat.isFile()||stat.size>100*1024*1024)throw Error('El archivo supera 100 MB.')
  return {name:path.basename(filename),bytes:new Uint8Array(await fs.readFile(filename))}
}
async function openBook(filename){
  if(!bookPath(filename))return
  pendingBook=filename
  if(ready){const file=await selectedBook(filename);pendingBook=null;window.webContents.send('lector-open-book',file)}
}
ipcMain.handle('lector-initial-book',async event=>{if(!trusted(event))throw Error('Origen no autorizado');ready=true;const filename=pendingBook;pendingBook=null;return filename?selectedBook(filename):null})
app.on('open-file',(event,filename)=>{event.preventDefault();openBook(filename).catch(()=>{})})
if(!quiet&&!app.requestSingleInstanceLock())app.quit()
else {
  app.on('second-instance',(_event,args)=>{const filename=args.find(bookPath);if(filename)openBook(filename).catch(()=>{});if(window){if(window.isMinimized())window.restore();window.focus()}})
  app.whenReady().then(async()=>{
    const folders=createFolderStore({file:path.join(app.getPath('userData'),'folder-grants.json'),pick:async()=>{const result=await dialog.showOpenDialog(window,{properties:['openDirectory']});return result.canceled?null:result.filePaths[0]}})
    for(const method of ['chooseFolder','permission','listDirectory','readFile'])ipcMain.handle('lector-folder-'+method,(event,data)=>{if(!trusted(event))throw Error('Origen no autorizado');return folders[method](data)})
    ipcMain.handle('lector-save-file',async(event,data)=>{if(!trusted(event)||typeof data.base64!=='string'||data.base64.length>140*1024*1024)throw Error('Archivo no válido');const result=await dialog.showSaveDialog(window,{defaultPath:path.basename(data.name??'Lector'),properties:['showOverwriteConfirmation']});if(result.canceled)return {cancelled:true};await fs.writeFile(result.filePath,Buffer.from(data.base64,'base64'));return {cancelled:false}})
    const root=path.join(app.getAppPath(),'dist')
    protocol.handle('lector',request=>{
      const target=assetPath(root,request.url)
      if(!target||!['GET','HEAD'].includes(request.method))return new Response('',{status:403})
      return net.fetch(pathToFileURL(target).toString())
    })
    Menu.setApplicationMenu(null)
    window=new BrowserWindow({width:1360,height:900,minWidth:600,minHeight:440,show:!quiet,title:'Lector',backgroundColor:'#f7f5ef',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true,offscreen:quiet}})
    window.webContents.setWindowOpenHandler(({url,frameName})=>{
      // The existing PKCE popup is isolated from Node, like the main window.
      if(['lector-onedrive','lector-print'].includes(frameName)&&url==='about:blank')return {action:'allow',overrideBrowserWindowOptions:{width:520,height:700,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}}}
      if(/^https?:\/\//i.test(url))shell.openExternal(url).catch(()=>{})
      return {action:'deny'}
    })
    window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(ORIGIN+'/')){event.preventDefault();if(/^https?:\/\//i.test(url))shell.openExternal(url).catch(()=>{})}})
    window.webContents.on('will-attach-webview',event=>event.preventDefault())
    if(!pendingBook)pendingBook=process.argv.find(bookPath)
    await window.loadURL(ORIGIN+'/index.html')
  })
  app.on('window-all-closed',()=>app.quit())
}
