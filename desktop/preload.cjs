const {contextBridge,ipcRenderer}=require('electron')
contextBridge.exposeInMainWorld('lectorDesktop',{
  platform:process.platform,
  chooseFolder:options=>ipcRenderer.invoke('lector-folder-chooseFolder',options),
  permission:options=>ipcRenderer.invoke('lector-folder-permission',options),
  listDirectory:options=>ipcRenderer.invoke('lector-folder-listDirectory',options),
  readFile:options=>ipcRenderer.invoke('lector-folder-readFile',options),
  saveFile:options=>ipcRenderer.invoke('lector-save-file',options),
  initialBook:()=>ipcRenderer.invoke('lector-initial-book'),
  onOpenBook:callback=>{const listener=(_event,file)=>callback(file);ipcRenderer.on('lector-open-book',listener);return ()=>ipcRenderer.removeListener('lector-open-book',listener)},
})
