import {it,expect} from 'vitest'
import {illuminatePaper,paperContrast} from '../src/paper-light.js'
import {sceneNames,scenePaperColors} from '../src/scene-palettes.js'
import {safeSettings} from '../src/storage.js'
import {portablePreferences} from '../src/sync-core.js'
it('preserves the original material unless enabled and applies exact personal colors across all scenes',()=>{
  for(const scene of sceneNames){const base=scenePaperColors(scene);expect(illuminatePaper(base,{paperLightEnabled:false,paperBrightness:60})).toEqual(base)
    const custom=scenePaperColors(scene,{paperLightEnabled:true,paperCustomColors:true,paperBackground:'#000000',paperInk:'#ffff00'})
    expect(custom.bg).toBe('#000000');expect(custom.ink).toBe('#ffff00');expect(paperContrast(custom.bg,custom.accent)).toBeGreaterThanOrEqual(4.5)
    const inverted=illuminatePaper(base,{paperLightEnabled:true,paperInverted:true});expect(inverted.bg).toBe(base.ink);expect(inverted.ink).toBe(base.bg)
  }
})
it('bounds intensity and warmth, keeps ink stable and measures low contrast honestly',()=>{
  const base=scenePaperColors('home'),warm=illuminatePaper(base,{paperLightEnabled:true,paperWarmth:100}),cool=illuminatePaper(base,{paperLightEnabled:true,paperWarmth:-100})
  expect(warm.bg).not.toBe(cool.bg);expect(warm.ink).toBe(base.ink)
  expect(illuminatePaper(base,{paperLightEnabled:true,paperBrightness:-100})).toEqual(illuminatePaper(base,{paperLightEnabled:true,paperBrightness:60}))
  expect(paperContrast('#000000','#ffffff')).toBe(21);expect(paperContrast('#444444','#444444')).toBe(1)
})
it('validates recovered controls and synchronizes only the chosen primitive preferences',()=>{
  const values=safeSettings({paperLightEnabled:'true',paperBrightness:999,paperWarmth:-999,paperBackground:'url(https://tracker.invalid)',paperInk:'#ffff00'})
  expect(values.paperLightEnabled).toBe(false);expect(values.paperBrightness).toBe(140);expect(values.paperWarmth).toBe(-100);expect(values.paperBackground).toBe('#f7efdc')
  expect(portablePreferences({paperLightEnabled:true,paperBrightness:90,paperInk:'#ffff00',image:'private'})).toEqual({paperLightEnabled:true,paperBrightness:90,paperInk:'#ffff00'})
})
