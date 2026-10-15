import {themeById} from './presentation.js'

export const sceneNames=['home','afternoon','night','cabin','school','office','library','bamboo','garden','study','olive']
export function effectiveScene(value,hour=new Date().getHours()){
  return value==='auto'?(hour>=7&&hour<18?'home':hour>=18&&hour<22?'afternoon':'night'):sceneNames.includes(value)?value:'home'
}
export function sceneTheme(value){
  const scene=effectiveScene(value)
  const theme=themeById(scene==='night'?'night':scene==='afternoon'?'afternoon':scene==='office'?'winter':'morning')
  if(scene==='night')return {...theme,icon:'moon',dark:true,colors:['#191b20','#23262c','#f5f1e9','#c1c4cd','#6d7480','#e3c58d','#665333','#30343e']}
  return {...theme,icon:({home:'comfort',afternoon:'sunset',cabin:'leaf',school:'book',office:'briefcase',library:'book',bamboo:'leaf',garden:'leaf',study:'book',olive:'leaf'})[scene]??theme.icon,colors:[scene==='school'?'#fff8e8':'#f7efdc',...theme.colors.slice(1)]}
}
// Paper is lit independently of the surrounding interface: a dark menu must
// never put pale text on the book's cream sheets, or dark text on a dark menu.
export function scenePaperColors(value){
  const scene=effectiveScene(value),theme=sceneTheme(value)
  if(scene==='night')return {bg:'#d9c5a0',ink:'#352c23',accent:'#594223',mark:'#c5b17f'}
  return {bg:theme.colors[0],ink:theme.colors[2],accent:theme.colors[5],mark:theme.colors[6]}
}
