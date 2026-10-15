import {it,expect} from 'vitest'
import {effectiveScene,sceneTheme,scenePaperColors} from '../src/scene-palettes.js'
const luminance=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0)
const contrast=(a,b)=>{const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05)}
it('uses a true dark interface at night and separately legible illuminated paper',()=>{
 const ui=sceneTheme('night'),paper=scenePaperColors('night')
 expect(ui.dark).toBe(true)
 for(const background of [ui.colors[0],ui.colors[1],ui.colors[7]])for(const ink of [ui.colors[2],ui.colors[3],ui.colors[5]])expect(contrast(background,ink)).toBeGreaterThanOrEqual(4.5)
 for(const ink of [paper.ink,paper.accent])expect(contrast(paper.bg,ink)).toBeGreaterThanOrEqual(4.5)
 expect(contrast(paper.mark,paper.ink)).toBeGreaterThanOrEqual(4.5)
})
it('resolves the automatic environment across day boundaries without changing the saved choice',()=>{
 expect([0,6,7,17,18,21,22,23].map(hour=>effectiveScene('auto',hour))).toEqual(['night','night','home','home','afternoon','afternoon','night','night'])
 expect(effectiveScene('olive',23)).toBe('olive');expect(sceneTheme('office').icon).toBe('briefcase')
})
