import {t,detectLanguage} from './i18n.js'
const parameters=new URLSearchParams(location.search),code=parameters.get('code'),state=parameters.get('state'),error=parameters.get('error')
history.replaceState(null,'',location.pathname)
document.getElementById('status').textContent=t('Puedes cerrar esta ventana.',detectLanguage())
if(state&&/^[a-zA-Z\d_-]{43}$/.test(state)){
 const message={type:'lector-onedrive-callback',code,state,error}
 window.opener?.postMessage(message,location.origin)
 if(typeof BroadcastChannel==='function'){const channel=new BroadcastChannel('lector-onedrive-'+state);channel.postMessage(message);setTimeout(()=>{channel.close();window.close()},250)}
}
