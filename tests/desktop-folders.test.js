import {it,expect} from 'vitest'
import {createRequire} from 'node:module'
import fs from 'node:fs/promises'
import path from 'node:path'
const {createFolderStore}=createRequire(import.meta.url)('../desktop/folders.cjs')
it('desktop grants are persistent, scoped and read only on a selected file',async()=>{
 const base=path.resolve('test-results');await fs.mkdir(base,{recursive:true});const temp=await fs.mkdtemp(path.join(base,'folder-test-'))
 try{const root=path.join(temp,'books');await fs.mkdir(root);await fs.writeFile(path.join(root,'libro.txt'),'original');await fs.writeFile(path.join(temp,'outside.txt'),'private');const grant=path.join(temp,'grants.json'),store=createFolderStore({file:grant,pick:async()=>root}),handle=await store.chooseFolder();expect((await store.listDirectory({rootId:handle.rootId})).entries).toEqual([{name:'libro.txt',kind:'file'}]);await expect(store.readFile({rootId:handle.rootId,parts:['..','outside.txt']})).rejects.toThrow();await expect(store.readFile({rootId:'unknown',parts:['libro.txt']})).rejects.toThrow();const reload=createFolderStore({file:grant,pick:async()=>null});expect(await reload.permission({rootId:handle.rootId})).toEqual({state:'granted'});const file=await reload.readFile({rootId:handle.rootId,parts:['libro.txt']});expect(Buffer.from(file.bytes).toString()).toBe('original');expect(await fs.readFile(path.join(root,'libro.txt'),'utf8')).toBe('original')}
 finally{if(!temp.startsWith(base+path.sep))throw Error('Unsafe test cleanup');await fs.rm(temp,{recursive:true,force:true})}
})
